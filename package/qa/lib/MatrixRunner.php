<?php
/**
 * Schema-driven OTA settings matrix: one factor at a time + optional critical pairs.
 * Always restores the snapshot (per-case and in finally).
 */
class QaMatrixRunner {
	/** @var QaOpenCart */
	private $boot;
	/** @var QaSettingsStore */
	private $store;
	/** @var array */
	private $schema;
	/** @var array */
	private $snapshot;
	/** @var string */
	private $module;

	public function __construct(QaOpenCart $boot, QaSettingsStore $store, array $schema) {
		$this->boot = $boot;
		$this->store = $store;
		$this->schema = $schema;
		$this->module = $schema['module'];
	}

	/**
	 * @param string $filterLayer  all|catalog_quote|catalog_soft|documented
	 * @return array report
	 */
	public function run($filterLayer = 'all') {
		$blobKey = $this->schema['setting_key'];
		$flatKeys = isset($this->schema['flat_keys']) ? $this->schema['flat_keys'] : array();

		$this->snapshot = $this->store->snapshot($blobKey, $flatKeys);

		$report = array(
			'module' => $this->module,
			'suite' => isset($this->schema['_suite']) ? $this->schema['_suite'] : 'cart',
			'filter' => $filterLayer,
			'started_at' => date('c'),
			'coverage' => array(
				'total_settings' => 0,
				'executed' => 0,
				'documented_only' => 0,
				'passed' => 0,
				'failed' => 0,
				'skipped' => 0
			),
			'cases' => array()
		);

		try {
			$cases = $this->expandCases($filterLayer);
			$report['coverage']['total_settings'] = count($this->schema['settings']);

			foreach ($cases as $case) {
				$result = $this->runCase($case);
				$report['cases'][] = $result;

				if ($result['status'] === 'pass') {
					$report['coverage']['passed']++;
					$report['coverage']['executed']++;
				} elseif ($result['status'] === 'fail') {
					$report['coverage']['failed']++;
					$report['coverage']['executed']++;
				} elseif ($result['status'] === 'documented') {
					$report['coverage']['documented_only']++;
				} else {
					$report['coverage']['skipped']++;
				}
			}
		} finally {
			$this->store->restore($this->snapshot);
			$this->boot->clearCache();
		}

		$report['finished_at'] = date('c');
		$report['ok'] = ($report['coverage']['failed'] === 0);

		return $report;
	}

	private function expandCases($filterLayer) {
		$cases = array();

		foreach ($this->schema['settings'] as $setting) {
			$layer = isset($setting['layer']) ? $setting['layer'] : 'documented';

			if ($filterLayer === 'catalog_quote' && $layer !== 'catalog_quote') {
				continue;
			}
			if ($filterLayer === 'catalog_soft' && !in_array($layer, array('catalog_quote', 'catalog_soft'), true)) {
				continue;
			}
			if ($filterLayer === 'documented' && !in_array($layer, array('admin_only', 'cn_only', 'macros', 'documented'), true)) {
				continue;
			}

			if (in_array($layer, array('admin_only', 'cn_only', 'macros', 'documented'), true)) {
				$cases[] = array(
					'id' => $setting['id'],
					'layer' => $layer,
					'path' => isset($setting['path']) ? $setting['path'] : null,
					'kind' => 'documented',
					'note' => isset($setting['note']) ? $setting['note'] : 'No catalog assert (documented coverage)'
				);
				continue;
			}

			$variants = isset($setting['variants']) ? $setting['variants'] : array();

			foreach ($variants as $i => $variant) {
				$cases[] = array(
					'id' => $setting['id'] . '#' . $i,
					'layer' => $layer,
					'path' => isset($setting['path']) ? $setting['path'] : null,
					'flat' => isset($setting['flat']) ? $setting['flat'] : null,
					'kind' => 'ota',
					'set' => $variant['set'],
					'flat_set' => isset($variant['flat_set']) ? $variant['flat_set'] : null,
					'expect' => isset($variant['expect']) ? $variant['expect'] : array('quote_ok' => true),
					'note' => isset($variant['note']) ? $variant['note'] : (isset($setting['note']) ? $setting['note'] : ''),
					'address_key' => isset($variant['address_key']) ? $variant['address_key'] : null,
					'session' => isset($variant['session']) ? $variant['session'] : null,
					'product_qty' => isset($variant['product_qty']) ? $variant['product_qty'] : null
				);
			}
		}

		if (!empty($this->schema['critical_pairs']) && in_array($filterLayer, array('all', 'catalog_quote', 'catalog_soft'), true)) {
			foreach ($this->schema['critical_pairs'] as $pair) {
				$cases[] = array(
					'id' => $pair['id'],
					'layer' => 'catalog_quote',
					'kind' => 'pair',
					'patches' => $pair['patches'],
					'flat_patches' => isset($pair['flat_patches']) ? $pair['flat_patches'] : array(),
					'expect' => $pair['expect'],
					'note' => isset($pair['note']) ? $pair['note'] : '',
					'address_key' => isset($pair['address_key']) ? $pair['address_key'] : null,
					'session' => isset($pair['session']) ? $pair['session'] : null,
					'product_qty' => isset($pair['product_qty']) ? $pair['product_qty'] : null
				);
			}
		}

		return $cases;
	}

	private function runCase(array $case) {
		if ($case['kind'] === 'documented') {
			return array(
				'id' => $case['id'],
				'layer' => $case['layer'],
				'status' => 'documented',
				'note' => $case['note']
			);
		}

		$pathValues = array();
		$flatValues = array();

		try {
			if ($case['kind'] === 'ota') {
				if (!empty($case['path'])) {
					$pathValues[$case['path']] = $case['set'];
				}
				if (!empty($case['flat']) && array_key_exists('flat_set', $case) && $case['flat_set'] !== null) {
					$flatValues[$case['flat']] = $case['flat_set'];
				} elseif (!empty($case['flat']) && isset($case['set']) && empty($case['path'])) {
					$flatValues[$case['flat']] = $case['set'];
				}
			} elseif ($case['kind'] === 'pair') {
				$pathValues = $case['patches'];
				$flatValues = $case['flat_patches'];
			}

			$this->store->applyPatches($this->schema['setting_key'], $pathValues, $flatValues);
			$this->boot->clearCache();

			$quote = $this->probeQuote($case);
			$assert = $this->assertQuote($quote, $case['expect']);

			$status = $assert['ok'] ? 'pass' : 'fail';

			return array(
				'id' => $case['id'],
				'layer' => $case['layer'],
				'status' => $status,
				'note' => $case['note'],
				'patches' => $pathValues,
				'flat_patches' => $flatValues,
				'quote_codes' => $this->quoteCodes($quote),
				'assert' => $assert
			);
		} catch (Exception $e) {
			return array(
				'id' => $case['id'],
				'layer' => $case['layer'],
				'status' => 'fail',
				'note' => $case['note'],
				'error' => $e->getMessage()
			);
		} finally {
			$this->store->restore($this->snapshot);
			$this->boot->clearCache();
		}
	}

	private function probeQuote(array $case = array()) {
		$registry = $this->boot->registry;
		$config = $registry->get('config');
		$session = $registry->get('session');
		$cart = $registry->get('cart');

		// Reload shipping_* settings from DB into config (startup already ran once).
		$db = $registry->get('db');
		$prefix = DB_PREFIX;
		$q = $db->query("SELECT * FROM `" . $prefix . "setting` WHERE store_id = '0' AND `key` LIKE 'shipping_" . $db->escape($this->module) . "%'");

		foreach ($q->rows as $row) {
			if (!$row['serialized']) {
				$config->set($row['key'], $row['value']);
			} else {
				$config->set($row['key'], json_decode($row['value'], true));
			}
		}

		if (!empty($case['session']) && is_array($case['session'])) {
			foreach ($case['session'] as $sk => $sv) {
				$session->data[$sk] = $sv;
			}
		}

		$productId = isset($this->schema['product_id']) ? (int) $this->schema['product_id'] : 40;
		$qty = !empty($case['product_qty']) ? (int) $case['product_qty'] : 1;
		$cart->clear();
		$cart->add($productId, $qty);

		if (empty($session->data['currency'])) {
			$session->data['currency'] = $config->get('config_currency');
		}

		$address = $this->resolveAddress($case);

		// Direct instance — Loader caches models in a static closure.
		$file = DIR_APPLICATION . 'model/extension/shipping/' . $this->module . '.php';
		if (!is_file($file)) {
			throw new RuntimeException('Shipping model not found: ' . $file);
		}
		require_once $file;

		$class = 'ModelExtensionShipping' . str_replace(' ', '', ucwords(str_replace('_', ' ', $this->module)));
		if (!class_exists($class)) {
			$class = 'ModelShipping' . str_replace(' ', '', ucwords(str_replace('_', ' ', $this->module)));
		}

		// Reset helper singleton if present so constructor rebinds settings.
		$registry->set($this->module, null);

		$model = new $class($registry);

		return $model->getQuote($address);
	}

	private function resolveAddress(array $case) {
		$key = !empty($case['address_key']) ? $case['address_key'] : null;

		if (!$key && !empty($this->schema['default_address'])) {
			$key = $this->schema['default_address'];
		}

		if ($key && !empty($this->schema['addresses'][$key])) {
			return $this->schema['addresses'][$key];
		}

		if (!empty($this->schema['address'])) {
			return $this->schema['address'];
		}

		throw new RuntimeException('No address fixture in schema');
	}

	private function quoteCodes($quote) {
		if (!$quote || empty($quote['quote']) || !is_array($quote['quote'])) {
			return array();
		}

		return array_keys($quote['quote']);
	}

	private function assertQuote($quote, array $expect) {
		$messages = array();
		$ok = true;
		$codes = $this->quoteCodes($quote);

		if (!empty($expect['quote_ok'])) {
			// null is ok when all methods filtered out; fatal would throw earlier
		}

		if (isset($expect['codes_present'])) {
			foreach ($expect['codes_present'] as $code) {
				if (!in_array($code, $codes, true)) {
					$ok = false;
					$messages[] = 'missing code: ' . $code;
				}
			}
		}

		if (isset($expect['codes_absent'])) {
			foreach ($expect['codes_absent'] as $code) {
				if (in_array($code, $codes, true)) {
					$ok = false;
					$messages[] = 'unexpected code: ' . $code;
				}
			}
		}

		if (isset($expect['codes_count_min']) && count($codes) < (int) $expect['codes_count_min']) {
			$ok = false;
			$messages[] = 'codes_count_min failed: got ' . count($codes);
		}

		if (isset($expect['codes_count_max']) && count($codes) > (int) $expect['codes_count_max']) {
			$ok = false;
			$messages[] = 'codes_count_max failed: got ' . count($codes);
		}

		if (isset($expect['cost_gt'])) {
			foreach ($expect['cost_gt'] as $code => $min) {
				$cost = isset($quote['quote'][$code]['cost']) ? (float) $quote['quote'][$code]['cost'] : 0;
				if ($cost <= (float) $min) {
					$ok = false;
					$messages[] = "cost_gt {$code}: got {$cost}";
				}
			}
		}

		if (isset($expect['cost_eq'])) {
			foreach ($expect['cost_eq'] as $code => $want) {
				$cost = isset($quote['quote'][$code]['cost']) ? (float) $quote['quote'][$code]['cost'] : 0;
				if (abs($cost - (float) $want) > 0.01) {
					$ok = false;
					$messages[] = "cost_eq {$code}: got {$cost} want {$want}";
				}
			}
		}

		if (isset($expect['text_period_nonempty'])) {
			foreach ($expect['text_period_nonempty'] as $code) {
				$text = isset($quote['quote'][$code]['text_period']) ? trim($quote['quote'][$code]['text_period']) : '';
				if ($text === '') {
					$ok = false;
					$messages[] = 'empty text_period: ' . $code;
				}
			}
		}

		if (!empty($expect['quote_null'])) {
			if ($quote) {
				$ok = false;
				$messages[] = 'expected null quote';
			}
		}

		return array(
			'ok' => $ok,
			'messages' => $messages,
			'codes' => $codes
		);
	}
}

<?php
/**
 * CN list filters + print settings resolution (DB seed + helper probes).
 */
class QaCnListRunner {
	/** @var QaAdminOpenCart */
	private $boot;
	/** @var QaSettingsStore */
	private $store;
	/** @var array */
	private $schema;
	/** @var array */
	private $snapshot;
	/** @var string[] */
	private $seeded = array();

	public function __construct(QaAdminOpenCart $boot, QaSettingsStore $store, array $schema) {
		$this->boot = $boot;
		$this->store = $store;
		$this->schema = $schema;
	}

	public function run() {
		$blobKey = isset($this->schema['setting_key']) ? $this->schema['setting_key'] : 'shipping_' . $this->schema['module'];
		$flatKeys = isset($this->schema['flat_keys']) ? $this->schema['flat_keys'] : array();
		$this->snapshot = $this->store->snapshot($blobKey, $flatKeys);

		$report = array(
			'module' => $this->schema['module'],
			'suite' => 'cn-list',
			'started_at' => date('c'),
			'coverage' => array(
				'total' => 0,
				'passed' => 0,
				'failed' => 0,
				'skipped' => 0
			),
			'cases' => array()
		);

		try {
			$this->seedRows();

			$cases = isset($this->schema['cases']) ? $this->schema['cases'] : array();
			$report['coverage']['total'] = count($cases);

			foreach ($cases as $case) {
				$result = $this->runCase($case);
				$report['cases'][] = $result;

				if ($result['status'] === 'pass') {
					$report['coverage']['passed']++;
				} elseif ($result['status'] === 'skip') {
					$report['coverage']['skipped']++;
				} else {
					$report['coverage']['failed']++;
				}
			}
		} finally {
			$this->cleanupSeed();
			$this->store->restore($this->snapshot);
			$this->boot->clearCache();
		}

		$report['finished_at'] = date('c');
		$report['ok'] = ($report['coverage']['failed'] === 0);

		return $report;
	}

	private function seedRows() {
		if (empty($this->schema['seed_rows'])) {
			return;
		}

		$db = $this->boot->registry->get('db');
		$table = DB_PREFIX . $this->schema['module'] . '_cns';

		foreach ($this->schema['seed_rows'] as $row) {
			$cn = $db->escape($row['cn_number']);
			$this->seeded[] = $row['cn_number'];

			$db->query("DELETE FROM `" . $table . "` WHERE `cn_number` = '" . $cn . "'");

			$db->query("INSERT INTO `" . $table . "` SET
				`cn_number` = '" . $cn . "',
				`parcel_id` = '" . $db->escape(isset($row['parcel_id']) ? $row['parcel_id'] : '') . "',
				`order_number` = '" . $db->escape(isset($row['order_number']) ? $row['order_number'] : '') . "',
				`created_at` = '" . $db->escape(isset($row['created_at']) ? $row['created_at'] : date('Y-m-d H:i:s')) . "',
				`departure_date` = NULL,
				`delivery_date` = NULL,
				`expiration_date` = NULL,
				`last_status_date` = NULL,
				`sender` = '" . $db->escape(isset($row['sender']) ? $row['sender'] : 'QA Sender') . "',
				`sender_phone` = '" . $db->escape(isset($row['sender_phone']) ? $row['sender_phone'] : '380501234567') . "',
				`sender_address` = '" . $db->escape(isset($row['sender_address']) ? $row['sender_address'] : '') . "',
				`recipient` = '" . $db->escape(isset($row['recipient']) ? $row['recipient'] : 'QA Recipient') . "',
				`recipient_address` = '" . $db->escape(isset($row['recipient_address']) ? $row['recipient_address'] : '') . "',
				`recipient_phone` = '" . $db->escape(isset($row['recipient_phone']) ? $row['recipient_phone'] : '380501234567') . "',
				`carrier` = 'Meest',
				`weight` = '" . (float) (isset($row['weight']) ? $row['weight'] : 1) . "',
				`declared_cost` = '" . (float) (isset($row['declared_cost']) ? $row['declared_cost'] : 100) . "',
				`shipping_cost` = '0',
				`description` = 'QA matrix seed',
				`payer_type` = 'recipient',
				`status` = '" . $db->escape(isset($row['status']) ? $row['status'] : 'created') . "',
				`last_status` = '',
				`updated_at` = NOW()");
		}
	}

	private function cleanupSeed() {
		if (!$this->seeded) {
			return;
		}

		$db = $this->boot->registry->get('db');
		$table = DB_PREFIX . $this->schema['module'] . '_cns';

		foreach ($this->seeded as $cn) {
			$db->query("DELETE FROM `" . $table . "` WHERE `cn_number` = '" . $db->escape($cn) . "'");
		}
	}

	private function runCase(array $case) {
		$kind = isset($case['kind']) ? $case['kind'] : 'list_filter';

		try {
			if ($kind === 'list_filter') {
				return $this->runListFilterCase($case);
			}
			if ($kind === 'print_resolve') {
				return $this->runPrintResolveCase($case);
			}
			if ($kind === 'print_label_smoke') {
				return $this->runPrintLabelSmokeCase($case);
			}

			return array('id' => $case['id'], 'status' => 'fail', 'error' => 'unknown kind');
		} catch (Exception $e) {
			return array('id' => $case['id'], 'status' => 'fail', 'error' => $e->getMessage());
		} finally {
			if (!empty($case['patches']) || !empty($case['flat_patches'])) {
				$this->store->restore($this->snapshot);
				$this->boot->clearCache();
			}
		}
	}

	private function runListFilterCase(array $case) {
		$file = DIR_APPLICATION . 'model/extension/shipping/' . $this->schema['module'] . '.php';
		require_once $file;

		$class = 'ModelExtensionShipping' . str_replace(' ', '', ucwords(str_replace('_', ' ', $this->schema['module'])));
		$model = new $class($this->boot->registry);

		$filter = isset($case['filter']) ? $case['filter'] : array();
		$rows = $model->getCNRows($filter);
		$total = $model->getCNRowsTotal($filter);
		$expect = isset($case['expect']) ? $case['expect'] : array();

		$messages = array();
		$ok = true;

		if (isset($expect['count'])) {
			if (count($rows) !== (int) $expect['count']) {
				$ok = false;
				$messages[] = 'rows count got ' . count($rows) . ' want ' . $expect['count'];
			}
		}

		if (isset($expect['total'])) {
			if ((int) $total !== (int) $expect['total']) {
				$ok = false;
				$messages[] = 'total got ' . $total . ' want ' . $expect['total'];
			}
		}

		if (isset($expect['count_min']) && count($rows) < (int) $expect['count_min']) {
			$ok = false;
			$messages[] = 'count_min failed';
		}

		if (isset($expect['first_cn'])) {
			if (empty($rows) || $rows[0]['cn_number'] !== $expect['first_cn']) {
				$ok = false;
				$messages[] = 'first_cn mismatch';
			}
		}

		return array(
			'id' => $case['id'],
			'status' => $ok ? 'pass' : 'fail',
			'note' => isset($case['note']) ? $case['note'] : '',
			'filter' => $filter,
			'count' => count($rows),
			'total' => $total,
			'assert' => array('ok' => $ok, 'messages' => $messages)
		);
	}

	private function runPrintResolveCase(array $case) {
		$pathValues = isset($case['patches']) ? $case['patches'] : array();
		$flatValues = isset($case['flat_patches']) ? $case['flat_patches'] : array();
		$blobKey = isset($this->schema['setting_key']) ? $this->schema['setting_key'] : 'shipping_' . $this->schema['module'];

		if ($pathValues || $flatValues) {
			$this->store->applyPatches($blobKey, $pathValues, $flatValues);
			$this->boot->clearCache();
		}

		$registry = $this->boot->registry;
		$config = $registry->get('config');
		$db = $registry->get('db');
		$q = $db->query("SELECT * FROM `" . DB_PREFIX . "setting` WHERE store_id = '0' AND `key` = '" . $db->escape($blobKey) . "' LIMIT 1");

		if ($q->num_rows) {
			$config->set($blobKey, json_decode($q->row['value'], true));
		}

		$settings = $config->get($blobKey);
		$get = isset($case['get']) ? $case['get'] : array();

		$variant = !empty($get['print_format']) ? $get['print_format'] : (!empty($settings['print_format']) ? $settings['print_format'] : 'sticker100');
		$contentType = !empty($get['print_declaration_type']) ? $get['print_declaration_type'] : (!empty($settings['print_declaration_type']) ? $settings['print_declaration_type'] : 'pdf');

		$expect = isset($case['expect']) ? $case['expect'] : array();
		$messages = array();
		$ok = true;

		if (isset($expect['variant']) && $expect['variant'] !== $variant) {
			$ok = false;
			$messages[] = "variant got {$variant} want {$expect['variant']}";
		}

		if (isset($expect['content_type']) && $expect['content_type'] !== $contentType) {
			$ok = false;
			$messages[] = "content_type got {$contentType} want {$expect['content_type']}";
		}

		return array(
			'id' => $case['id'],
			'status' => $ok ? 'pass' : 'fail',
			'note' => isset($case['note']) ? $case['note'] : '',
			'resolved' => array('variant' => $variant, 'content_type' => $contentType),
			'assert' => array('ok' => $ok, 'messages' => $messages)
		);
	}

	private function runPrintLabelSmokeCase(array $case) {
		$registry = $this->boot->registry;
		require_once DIR_SYSTEM . 'helper/' . $this->schema['module'] . '.php';
		$registry->set($this->schema['module'], null);
		$helperClass = ucfirst($this->schema['module']);
		$meest = new $helperClass($registry);

		$barcode = isset($case['barcode']) ? $case['barcode'] : 'QA-FAKE-BARCODE-000';
		$variant = isset($case['variant']) ? $case['variant'] : 'sticker100';
		$result = $meest->label($barcode, $variant, '380501234567', 'pdf');

		$expect = isset($case['expect']) ? $case['expect'] : array('returns_false' => true);
		$messages = array();
		$ok = true;

		if (!empty($expect['returns_false']) && $result !== false) {
			$ok = false;
			$messages[] = 'expected false from label() for fake barcode';
		}

		if (!empty($expect['not_pdf'])) {
			if (is_string($result) && strlen($result) > 4 && strpos($result, '%PDF') === 0) {
				$ok = false;
				$messages[] = 'unexpected valid PDF for fake barcode';
			}
		}

		if (!empty($expect['returns_truthy']) && !$result) {
			$ok = false;
			$messages[] = 'expected non-false from label()';
		}

		if (!empty($expect['pdf_magic']) && is_string($result) && strpos($result, '%PDF') !== 0) {
			$ok = false;
			$messages[] = 'expected PDF magic bytes';
		}

		return array(
			'id' => $case['id'],
			'status' => $ok ? 'pass' : 'fail',
			'note' => isset($case['note']) ? $case['note'] : '',
			'result_type' => $result === false ? 'false' : (is_string($result) ? 'string:' . strlen($result) : gettype($result)),
			'assert' => array('ok' => $ok, 'messages' => $messages)
		);
	}
}

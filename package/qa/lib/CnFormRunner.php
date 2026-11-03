<?php
/**
 * CN (TTN) form validation matrix via ControllerShippingMeest::validateCNForm (reflection).
 */
class QaCnFormRunner {
	/** @var QaAdminOpenCart */
	private $boot;
	/** @var array */
	private $schema;

	public function __construct(QaAdminOpenCart $boot, array $schema) {
		$this->boot = $boot;
		$this->schema = $schema;
	}

	public function run() {
		$report = array(
			'module' => $this->schema['module'],
			'suite' => 'cn-form',
			'started_at' => date('c'),
			'coverage' => array(
				'total' => 0,
				'passed' => 0,
				'failed' => 0,
				'skipped' => 0
			),
			'cases' => array()
		);

		$cases = isset($this->schema['cases']) ? $this->schema['cases'] : array();
		$report['coverage']['total'] = count($cases);
		$baseline = isset($this->schema['valid_post']) ? $this->schema['valid_post'] : array();

		foreach ($cases as $case) {
			$result = $this->runCase($case, $baseline);
			$report['cases'][] = $result;

			if ($result['status'] === 'pass') {
				$report['coverage']['passed']++;
			} elseif ($result['status'] === 'skip') {
				$report['coverage']['skipped']++;
			} else {
				$report['coverage']['failed']++;
			}
		}

		$report['finished_at'] = date('c');
		$report['ok'] = ($report['coverage']['failed'] === 0);

		return $report;
	}

	private function runCase(array $case, array $baseline) {
		$post = $baseline;

		if (!empty($case['post'])) {
			foreach ($case['post'] as $k => $v) {
				$post[$k] = $v;
			}
		}

		if (!empty($case['unset'])) {
			foreach ((array) $case['unset'] as $key) {
				unset($post[$key]);
			}
		}

		try {
			$result = $this->validatePost($post);
			$assert = $this->assertValidation($result, isset($case['expect']) ? $case['expect'] : array());

			return array(
				'id' => $case['id'],
				'status' => $assert['ok'] ? 'pass' : 'fail',
				'note' => isset($case['note']) ? $case['note'] : '',
				'valid' => $result['valid'],
				'errors' => $result['errors'],
				'assert' => $assert
			);
		} catch (Exception $e) {
			return array(
				'id' => $case['id'],
				'status' => 'fail',
				'error' => $e->getMessage()
			);
		}
	}

	private function validatePost(array $post) {
		$registry = $this->boot->registry;
		$registry->get('request')->post = $post;
		$registry->get('request')->server['REQUEST_METHOD'] = 'POST';

		$file = DIR_APPLICATION . 'controller/extension/shipping/' . $this->schema['module'] . '.php';
		require_once $file;

		$class = 'ControllerExtensionShipping' . str_replace(' ', '', ucwords(str_replace('_', ' ', $this->schema['module'])));
		if (!class_exists($class)) {
			$class = 'ControllerShipping' . str_replace(' ', '', ucwords(str_replace('_', ' ', $this->schema['module'])));
		}

		$registry->set($this->schema['module'], null);
		$controller = new $class($registry);

		$registry->get('load')->language('extension/shipping/' . $this->schema['module']);

		$ref = new ReflectionClass('ControllerShippingMeest');
		$method = $ref->getMethod('validateCNForm');
		$method->setAccessible(true);
		$valid = (bool) $method->invoke($controller);

		$errorProp = $ref->getProperty('error');
		$errorProp->setAccessible(true);
		$errors = $errorProp->getValue($controller);
		$fieldErrors = isset($errors['errors']) && is_array($errors['errors']) ? $errors['errors'] : array();

		return array(
			'valid' => $valid,
			'errors' => $fieldErrors
		);
	}

	private function assertValidation(array $result, array $expect) {
		$messages = array();
		$ok = true;

		if (isset($expect['valid'])) {
			if ((bool) $expect['valid'] !== $result['valid']) {
				$ok = false;
				$messages[] = 'valid expected ' . ($expect['valid'] ? 'true' : 'false') . ' got ' . ($result['valid'] ? 'true' : 'false');
			}
		}

		if (isset($expect['error_fields'])) {
			foreach ((array) $expect['error_fields'] as $field) {
				if (!isset($result['errors'][$field])) {
					$ok = false;
					$messages[] = 'missing error field: ' . $field;
				}
			}
		}

		if (isset($expect['no_error_fields'])) {
			foreach ((array) $expect['no_error_fields'] as $field) {
				if (isset($result['errors'][$field])) {
					$ok = false;
					$messages[] = 'unexpected error field: ' . $field;
				}
			}
		}

		return array(
			'ok' => $ok,
			'messages' => $messages
		);
	}
}

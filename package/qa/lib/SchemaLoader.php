<?php
class QaSchemaLoader {
	public static function load($module, $suite, $schemasDir) {
		$module = preg_replace('/[^a-z0-9_]/', '', $module);
		$suite = preg_replace('/[^a-z0-9_-]/', '', $suite);

		$candidates = array(
			$schemasDir . '/' . $module . '/' . $suite . '.json',
			$schemasDir . '/' . $module . '.' . $suite . '.json',
		);

		if ($suite === 'cart') {
			$candidates[] = $schemasDir . '/' . $module . '.json';
		}

		foreach ($candidates as $file) {
			if (is_file($file)) {
				$data = json_decode(file_get_contents($file), true);
				if (!is_array($data)) {
					throw new RuntimeException('Invalid schema JSON: ' . $file);
				}
				$data['_schema_file'] = $file;
				$data['_suite'] = $suite;
				return $data;
			}
		}

		throw new RuntimeException("Schema not found for {$module}/{$suite}");
	}
}

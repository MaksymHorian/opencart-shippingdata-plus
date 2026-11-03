<?php
/**
 * Snapshot / patch / restore for OpenCart setting rows (JSON-serialized blobs + flat keys).
 */
class QaSettingsStore {
	/** @var DB */
	private $db;
	/** @var string */
	private $prefix;

	public function __construct($db, $prefix = 'oc_') {
		$this->db = $db;
		$this->prefix = $prefix;
	}

	/**
	 * @param string   $blobKey  e.g. shipping_meest
	 * @param string[] $flatKeys e.g. shipping_meest_status
	 * @return array{blob: ?array{value:string,serialized:string}, flat: array<string,array{value:string,serialized:string}>}
	 */
	public function snapshot($blobKey, array $flatKeys = array()) {
		$out = array(
			'blob' => $this->fetchRow($blobKey),
			'flat' => array()
		);

		foreach ($flatKeys as $key) {
			$out['flat'][$key] = $this->fetchRow($key);
		}

		return $out;
	}

	public function restore(array $snapshot) {
		if (!empty($snapshot['blob']) && !empty($snapshot['blob']['key'])) {
			$this->writeRow($snapshot['blob']['key'], $snapshot['blob']['value'], $snapshot['blob']['serialized']);
		}

		foreach ($snapshot['flat'] as $key => $row) {
			if ($row) {
				$this->writeRow($key, $row['value'], $row['serialized']);
			}
		}
	}

	/**
	 * Deep-merge patches into the JSON blob and optional flat key overrides.
	 *
	 * @param string $blobKey
	 * @param array  $pathValues  map "a.b.c" => value
	 * @param array  $flatValues  map flat_key => value
	 */
	public function applyPatches($blobKey, array $pathValues = array(), array $flatValues = array()) {
		$row = $this->fetchRow($blobKey);

		if (!$row) {
			throw new RuntimeException('Setting not found: ' . $blobKey);
		}

		$data = json_decode($row['value'], true);

		if (!is_array($data)) {
			throw new RuntimeException('Setting blob is not JSON: ' . $blobKey);
		}

		foreach ($pathValues as $path => $value) {
			$this->setPath($data, $path, $value);
		}

		$encoded = json_encode($data, JSON_UNESCAPED_UNICODE);

		if ($encoded === false) {
			throw new RuntimeException('json_encode failed for ' . $blobKey);
		}

		$this->writeRow($blobKey, $encoded, '1');

		foreach ($flatValues as $key => $value) {
			$serialized = is_array($value) ? '1' : '0';
			$store = is_array($value) ? json_encode($value, JSON_UNESCAPED_UNICODE) : (string) $value;
			$this->writeRow($key, $store, $serialized);
		}
	}

	/**
	 * @return ?array{key:string,value:string,serialized:string}
	 */
	private function fetchRow($key) {
		$q = $this->db->query(
			"SELECT `key`, `value`, `serialized` FROM `" . $this->prefix . "setting` WHERE `key` = '" . $this->db->escape($key) . "' AND store_id = '0' LIMIT 1"
		);

		if (!$q->num_rows) {
			return null;
		}

		return array(
			'key' => $q->row['key'],
			'value' => $q->row['value'],
			'serialized' => (string) $q->row['serialized']
		);
	}

	private function writeRow($key, $value, $serialized) {
		$this->db->query(
			"UPDATE `" . $this->prefix . "setting` SET `value` = '" . $this->db->escape($value) . "', `serialized` = '" . (int) $serialized . "' WHERE `key` = '" . $this->db->escape($key) . "' AND store_id = '0'"
		);
	}

	private function setPath(array &$data, $path, $value) {
		$parts = explode('.', $path);
		$ref = &$data;

		foreach ($parts as $i => $part) {
			$last = ($i === count($parts) - 1);

			if ($last) {
				$ref[$part] = $value;
			} else {
				if (!isset($ref[$part]) || !is_array($ref[$part])) {
					$ref[$part] = array();
				}
				$ref = &$ref[$part];
			}
		}
	}
}

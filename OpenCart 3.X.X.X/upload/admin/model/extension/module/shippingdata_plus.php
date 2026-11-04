<?php
/**
 * "Shipping Data Plus" - module for OpenCart
 *
 * @author     Prorab337
 * @copyright  (c) 2015-2026 OC Max
 * @licence    MIT. Free to use, modify and redistribute.
 *             Keep this notice and credit Prorab337 / OC Max
 *             (https://oc-max.com).
 * @link       https://oc-max.com
 */

class ModelExtensionModuleShippingdataPlus extends Model {
	private $phrases = null;
	private $names = array();
	private static $cn_columns = null;

	public function isCarrier($code) {
		$map = $this->carrierMap();

		return isset($map[$code]);
	}

	public function isType($type) {
		return $type === 'cities' || $type === 'departments';
	}

	public function getOrdersTtn($order_ids, $include_owned = false) {
		$ids = $this->orderIds($order_ids);

		if (!$ids) {
			return array();
		}

		$columns = $this->cnColumnsPresent();
		$select = array('`order_id`', '`shipping_code`', '`shipping_method`');

		foreach ($columns as $column) {
			$select[] = '`' . $column . '`';
		}

		$query = $this->db->query("SELECT " . implode(', ', $select) . " FROM `" . DB_PREFIX . "order` WHERE `order_id` IN (" . implode(',', $ids) . ")");
		$out = array();

		foreach ($query->rows as $row) {
			$resolved = $this->resolveOrderTtn($row);

			if (!$resolved) {
				continue;
			}

			// Leave the row to Nova Poshta PRO when that module already owns the order.
			// Account fill passes $include_owned so an empty PRO cell can still show the number.
			if (!$include_owned && $resolved['carrier'] === 'novaposhta' && $this->proOwnsNovaPoshtaOrder($row['order_id'])) {
				continue;
			}

			$out[(string)(int)$row['order_id']] = $resolved;
		}

		return $out;
	}

	public function countType($carrier, $type) {
		if (!$this->isCarrier($carrier) || !$this->isType($type)) {
			return 0;
		}

		foreach ($this->carrierMap() as $code => $tables) {
			if ($code !== $carrier) {
				continue;
			}

			foreach ($tables as $table) {
				if (substr($table, -strlen($type)) === $type) {
					return $this->countPhysical($table, '');
				}
			}
		}

		return 0;
	}

	public function carrierCodes() {
		return array_keys($this->sortedCarrierMap());
	}

	public function panels() {
		$panels = array();

		foreach ($this->sortedCarrierMap() as $code => $tables) {
			$panels[] = array(
				'code'      => $code,
				'name'      => $this->carrierName($code),
				'backed_up' => (string)$this->config->get('module_shippingdata_plus_backup_' . $code),
				'tables'    => $this->tableCounts($code)
			);
		}

		return $panels;
	}

	public function backup($carrier) {
		$tables = $this->tables($carrier);

		if (!$tables) {
			return array('error' => 'error_carrier');
		}

		foreach ($tables as $table) {
			if (!$this->tableExists(DB_PREFIX . $table)) {
				return array('error' => 'error_backup');
			}
		}

		// Stage the copy in __sdp_new. The spare is replaced only after every
		// table copy succeeds, so a failed copy leaves the previous backup in place.
		try {
			foreach ($tables as $table) {
				$live = $this->physical($table, '');
				$fresh = $this->physical($table, '__sdp_new');

				$this->db->query('DROP TABLE IF EXISTS ' . $fresh);
				$this->db->query('CREATE TABLE ' . $fresh . ' LIKE ' . $live);
				$this->db->query('INSERT INTO ' . $fresh . ' SELECT * FROM ' . $live);
			}
		} catch (Exception $e) {
			$this->dropFreshCopies($tables);

			return array('error' => 'error_backup');
		}

		try {
			foreach ($tables as $table) {
				$spare = $this->physical($table, '__sdp');
				$fresh = $this->physical($table, '__sdp_new');

				$this->db->query('DROP TABLE IF EXISTS ' . $spare);
				$this->db->query('RENAME TABLE ' . $fresh . ' TO ' . $spare);
			}
		} catch (Exception $e) {
			$this->keepSpare($tables);

			return array('error' => 'error_backup');
		}

		$stamp = date('Y-m-d H:i:s');
		$this->saveSetting('module_shippingdata_plus_backup_' . $carrier, $stamp);

		return array(
			'carrier'   => $carrier,
			'backed_up' => $stamp,
			'tables'    => $this->tableCounts($carrier)
		);
	}

	public function restore($carrier) {
		$tables = $this->tables($carrier);

		if (!$tables) {
			return array('error' => 'error_carrier');
		}

		foreach ($tables as $table) {
			if (!$this->tableExists(DB_PREFIX . $table) || !$this->tableExists(DB_PREFIX . $table . '__sdp')) {
				return array('error' => 'error_restore');
			}
		}

		$rename = array();

		try {
			foreach ($tables as $table) {
				$spare = $this->physical($table, '__sdp');
				$fresh = $this->physical($table, '__sdp_new');

				$this->db->query('DROP TABLE IF EXISTS ' . $fresh);
				$this->db->query('CREATE TABLE ' . $fresh . ' LIKE ' . $spare);
				$this->db->query('INSERT INTO ' . $fresh . ' SELECT * FROM ' . $spare);
			}

			// Rename live aside and the staged copy into place together. The __sdp
			// spare is not part of this swap, so the backup can be restored again.
			foreach ($tables as $table) {
				$live = $this->physical($table, '');
				$aside = $this->physical($table, '__aside');
				$fresh = $this->physical($table, '__sdp_new');

				if ($this->tableExists(DB_PREFIX . $table) && $this->tableExists(DB_PREFIX . $table . '__aside')) {
					// Live is current. This aside is left from a swap whose drop did not finish.
					$this->db->query('DROP TABLE IF EXISTS ' . $aside);
				}

				$rename[] = $live . ' TO ' . $aside;
				$rename[] = $fresh . ' TO ' . $live;
			}

			$this->db->query('RENAME TABLE ' . implode(', ', $rename));
		} catch (Exception $e) {
			$this->putAsideBack($tables);
			$this->dropFreshCopies($tables);

			return array('error' => 'error_failed');
		}

		foreach ($tables as $table) {
			$aside = $this->physical($table, '__aside');

			if ($aside === '') {
				continue;
			}

			try {
				$this->db->query('DROP TABLE IF EXISTS ' . $aside);
			} catch (Exception $e) {
			}
		}

		return array(
			'carrier'   => $carrier,
			'backed_up' => (string)$this->config->get('module_shippingdata_plus_backup_' . $carrier),
			'tables'    => $this->tableCounts($carrier)
		);
	}

	public function dropShadows() {
		foreach ($this->carrierMap() as $tables) {
			foreach ($tables as $table) {
				foreach (array('__sdp', '__sdp_new', '__aside') as $suffix) {
					$name = $this->physical($table, $suffix);

					if ($name === '') {
						continue;
					}

					try {
						$this->db->query('DROP TABLE IF EXISTS ' . $name);
					} catch (Exception $e) {
					}
				}
			}
		}
	}

	public function saveNavbarCount($carrier, $type, $count) {
		if (!$this->isCarrier($carrier) || !$this->isType($type)) {
			return;
		}

		$this->saveSetting('module_shippingdata_plus_navbar_' . $carrier . '_' . $type, (string)(int)$count);
	}

	public function carrierName($code) {
		if (isset($this->names[$code])) {
			return $this->names[$code];
		}

		if (!$this->isCarrier($code)) {
			return '';
		}

		if (!defined('DIR_CATALOG')) {
			$key = 'text_carrier_' . $code;
			$name = $this->phrase($key);

			if ($name === $key) {
				$name = $code;
			}
		} else {
			$strings = $this->readLanguage('extension/shipping/' . $code);
			$name = isset($strings['heading_title']) ? $strings['heading_title'] : $code;
		}

		$this->names[$code] = $name;

		return $name;
	}

	public function phrase($key) {
		if ($this->phrases === null) {
			$this->phrases = $this->readLanguage('extension/module/shippingdata_plus');
		}

		return isset($this->phrases[$key]) ? $this->phrases[$key] : $key;
	}

	public function proAccountColumn() {
		return $this->eventEnabled('novaposhta_pro_account_list');
	}

	public function proOrderListColumn() {
		if (!$this->eventEnabled('novaposhta_pro_order_list')) {
			return false;
		}

		return $this->proAccess();
	}

	public function proOwnsNovaPoshtaOrder($order_id) {
		$order_id = (int)$order_id;

		if ($order_id < 1 || !$this->eventEnabled('novaposhta_pro_order_info')) {
			return false;
		}

		if (defined('DIR_CATALOG') && !$this->proAccess()) {
			return false;
		}

		$query = $this->db->query("SELECT `store_id`, `shipping_code` FROM `" . DB_PREFIX . "order` WHERE `order_id` = '" . $order_id . "' LIMIT 1");

		if (!$query->num_rows) {
			return false;
		}

		$store_id = (int)$query->row['store_id'];
		$code = strtolower(trim((string)$query->row['shipping_code']));

		if ($this->proHasShipment($store_id, $order_id)) {
			return true;
		}

		return $this->proShippingCode($store_id, $code);
	}

	private function resolveOrderTtn($order) {
		$shipping_code = isset($order['shipping_code']) ? trim((string)$order['shipping_code']) : '';
		$filled = array();

		foreach (array_keys($this->carrierMap()) as $carrier) {
			$value = isset($order[$carrier . '_cn_number']) ? trim((string)$order[$carrier . '_cn_number']) : '';

			if ($value !== '') {
				$filled[$carrier] = $value;
			}
		}

		$code = '';
		$number = '';

		// shipping_code wins when it names a carrier. When it is empty, use the
		// number only if exactly one carrier column is filled.
		if ($shipping_code !== '') {
			$code = $this->identifiedCarrier($shipping_code);

			if ($code !== '' && isset($filled[$code])) {
				$number = $filled[$code];
			}
		} elseif (count($filled) === 1) {
			foreach ($filled as $code => $number) {
				break;
			}
		} else {
			return null;
		}

		if ($code === '' || $number === '') {
			return null;
		}

		$method = isset($order['shipping_method']) ? trim((string)$order['shipping_method']) : '';
		$brand = $this->brand($code);
		$label = $this->carrierName($code);

		if (strlen($label) >= 4 && substr($label, -4) === ' API') {
			$label = substr($label, 0, -4);
		}

		return array(
			'carrier'         => $code,
			'carrier_name'    => $label,
			'number'          => $number,
			'display'         => $this->displayNumber($code, $number),
			'tracking'        => $this->trackingUrl($code, $number),
			'shipping_method' => $method !== '' ? $method : $this->carrierName($code),
			'bg'              => $brand['bg'],
			'ink'             => $brand['ink']
		);
	}

	private function identifiedCarrier($shipping_code) {
		$shipping_code = trim((string)$shipping_code);
		$dot = strpos($shipping_code, '.');
		$raw_base = $dot === false ? $shipping_code : substr($shipping_code, 0, $dot);
		$base = strtolower($raw_base);

		if ($this->isCarrier($base)) {
			return $base;
		}

		$matched = '';

		foreach (array_keys($this->carrierMap()) as $code) {
			if (!$this->config->get('shipping_' . $code . '_status')) {
				continue;
			}

			$settings = $this->config->get('shipping_' . $code);

			if (!is_array($settings) || empty($settings['compatible_shipping_method']) || !is_array($settings['compatible_shipping_method'])) {
				continue;
			}

			$methods = $this->methodCodes($settings['compatible_shipping_method']);

			if (!in_array($shipping_code, $methods) && !in_array($raw_base, $methods)) {
				continue;
			}

			if ($matched !== '') {
				return '';
			}

			$matched = $code;
		}

		return $matched;
	}

	private function displayNumber($carrier, $number) {
		if ($carrier === 'meest' || !preg_match('/^[0-9]+$/', $number)) {
			return $number;
		}

		$length = strlen($number);
		$head = $length % 4;
		$parts = array();

		if ($head > 0) {
			$parts[] = substr($number, 0, $head);
		}

		for ($offset = $head; $offset < $length; $offset += 4) {
			$parts[] = substr($number, $offset, 4);
		}

		return implode(' ', $parts);
	}

	private function brand($carrier) {
		$map = array(
			'novaposhta'       => array('bg' => '#ff392e', 'ink' => '#ffffff'),
			'ukrposhta'        => array('bg' => '#FFBE21', 'ink' => '#1e1e1e'),
			'rozetka_delivery' => array('bg' => '#00A046', 'ink' => '#ffffff'),
			'meest'            => array('bg' => '#deebf5', 'ink' => '#1e1e1e')
		);

		if (isset($map[$carrier])) {
			return $map[$carrier];
		}

		return array('bg' => '#1e91cf', 'ink' => '#ffffff');
	}

	private function proAccess() {
		if (!$this->registry->has('user')) {
			return false;
		}

		return $this->user->hasPermission('access', 'extension/shipping/novaposhta_pro');
	}

	private function eventEnabled($code) {
		if (!preg_match('/^[a-z0-9_]+$/', $code)) {
			return false;
		}

		$query = $this->db->query("SELECT `event_id` FROM `" . DB_PREFIX . "event` WHERE `code` = '" . $this->db->escape($code) . "' AND `status` = '1' LIMIT 1");

		return $query->num_rows > 0;
	}

	private function proHasShipment($store_id, $order_id) {
		if (!$this->tableExists(DB_PREFIX . 'npp_shipment')) {
			return false;
		}

		$query = $this->db->query("SELECT `shipment_id` FROM `" . DB_PREFIX . "npp_shipment` WHERE `store_id` = '" . (int)$store_id . "' AND `order_id` = '" . (int)$order_id . "' AND NOT (`ttn` IS NOT NULL AND `ttn` <> '' AND (`status_key` = 'cancelled' OR `cancel_state` = 'committed')) LIMIT 1");

		return $query->num_rows > 0;
	}

	private function proShippingCode($store_id, $code) {
		if (strpos($code, 'novaposhta_pro.') === 0) {
			return true;
		}

		if ($code === '' || !$this->tableExists(DB_PREFIX . 'npp_setting')) {
			return false;
		}

		$query = $this->db->query("SELECT `value` FROM `" . DB_PREFIX . "npp_setting` WHERE `store_id` = '" . (int)$store_id . "' AND `sender_id` = '0' AND `group` = 'consignment' AND `key` = 'compatible_shipping_method' LIMIT 1");

		if (!$query->num_rows) {
			return false;
		}

		$decoded = json_decode((string)$query->row['value'], true);

		if (!is_array($decoded)) {
			return false;
		}

		$codes = array();

		foreach ($decoded as $element) {
			$item = is_array($element) && isset($element['code']) ? $element['code'] : $element;
			$item = strtolower(trim((string)$item));

			if ($item === '' || !preg_match('/^[a-z_][a-z0-9_]*(\\.[a-z0-9_]+)?$/', $item) || $item === 'novaposhta_pro' || strpos($item, 'novaposhta_pro.') === 0) {
				continue;
			}

			$codes[] = $item;
		}

		$dot = strpos($code, '.');

		return in_array($code, $codes, true) || ($dot !== false && $dot > 0 && in_array(substr($code, 0, $dot), $codes, true));
	}

	private function trackingUrl($carrier, $number) {
		$number = rawurlencode($number);

		if ($carrier === 'novaposhta') {
			return 'https://novaposhta.ua/tracking/' . $number . '/';
		}

		if ($carrier === 'ukrposhta') {
			return 'https://track.ukrposhta.ua/tracking_UA.html?barcode=' . $number;
		}

		if ($carrier === 'rozetka_delivery') {
			return 'https://rozetka.delivery/tracking/parcel?parcel_id=' . $number;
		}

		if ($carrier === 'meest') {
			return 'https://ua.meest.com/parcel-track?parcel_number=' . $number;
		}

		return '';
	}

	private function methodCodes($methods) {
		$codes = array();

		foreach ($methods as $key => $value) {
			if (is_string($value) || is_numeric($value)) {
				$codes[] = (string)$value;
			} elseif (is_array($value) && isset($value['code'])) {
				$codes[] = (string)$value['code'];
			}

			if (is_string($key) && $key !== '') {
				$codes[] = $key;
			}
		}

		return $codes;
	}

	private function tableCounts($carrier) {
		$rows = array();

		foreach ($this->tables($carrier) as $table) {
			$rows[] = array(
				'name'  => $table,
				'kind'  => $this->tableKind($table),
				'live'  => $this->countPhysical($table, ''),
				'spare' => $this->countPhysical($table, '__sdp')
			);
		}

		return $rows;
	}

	private function tableKind($table) {
		foreach (array('references', 'departments', 'regions', 'cities') as $kind) {
			if (substr($table, -strlen($kind)) === $kind) {
				return $kind;
			}
		}

		return '';
	}

	private function tables($carrier) {
		$map = $this->carrierMap();

		return isset($map[$carrier]) ? $map[$carrier] : array();
	}

	private function carrierMap() {
		return array(
			'novaposhta'       => array('novaposhta_regions', 'novaposhta_cities', 'novaposhta_departments', 'novaposhta_references'),
			'rozetka_delivery' => array('rozetka_delivery_cities', 'rozetka_delivery_departments', 'rozetka_delivery_references'),
			'ukrposhta'        => array('ukrposhta_regions', 'ukrposhta_cities', 'ukrposhta_departments', 'ukrposhta_references'),
			'meest'            => array('meest_regions', 'meest_cities', 'meest_departments', 'meest_references')
		);
	}

	private function sortedCarrierMap() {
		$map = $this->carrierMap();
		$codes = array_keys($map);

		usort($codes, array($this, 'compareCarrierOrder'));

		$sorted = array();

		foreach ($codes as $code) {
			$sorted[$code] = $map[$code];
		}

		return $sorted;
	}

	private function compareCarrierOrder($left, $right) {
		$delta = (int)$this->config->get('shipping_' . $left . '_sort_order') - (int)$this->config->get('shipping_' . $right . '_sort_order');

		if ($delta !== 0) {
			return $delta;
		}

		return strcmp($left, $right);
	}

	private function physical($table, $suffix) {
		if (!in_array($table, $this->whitelist(), true)) {
			return '';
		}

		if ($suffix !== '' && $suffix !== '__sdp' && $suffix !== '__sdp_new' && $suffix !== '__aside') {
			return '';
		}

		return '`' . DB_PREFIX . $table . $suffix . '`';
	}

	private function whitelist() {
		$names = array();

		foreach ($this->carrierMap() as $tables) {
			foreach ($tables as $table) {
				$names[] = $table;
			}
		}

		return $names;
	}

	private function countPhysical($table, $suffix) {
		$quoted = $this->physical($table, $suffix);

		if ($quoted === '' || !$this->tableExists(DB_PREFIX . $table . $suffix)) {
			return 0;
		}

		$query = $this->db->query('SELECT COUNT(*) AS total FROM ' . $quoted);

		return (int)$query->row['total'];
	}

	private function tableExists($name) {
		$query = $this->db->query("SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '" . $this->db->escape($name) . "'");

		return !empty($query->row['total']);
	}

	private function orderIds($order_ids) {
		$ids = array();

		if (!is_array($order_ids)) {
			return $ids;
		}

		if (count($order_ids) > 200) {
			$order_ids = array_slice($order_ids, 0, 200);
		}

		foreach ($order_ids as $value) {
			if (is_int($value)) {
				$value = (string)$value;
			}

			if (is_string($value) && preg_match('/^[1-9][0-9]*$/', $value)) {
				$id = (int)$value;

				if (!in_array($id, $ids, true)) {
					$ids[] = $id;
				}
			}
		}

		return $ids;
	}

	private function cnColumnsPresent() {
		if (self::$cn_columns !== null) {
			return self::$cn_columns;
		}

		$wanted = array(
			'novaposhta_cn_number',
			'rozetka_delivery_cn_number',
			'ukrposhta_cn_number',
			'meest_cn_number'
		);
		$in = array();

		foreach ($wanted as $column) {
			$in[] = "'" . $column . "'";
		}

		$query = $this->db->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '" . $this->db->escape(DB_PREFIX . 'order') . "' AND COLUMN_NAME IN (" . implode(',', $in) . ")");
		$present = array();

		foreach ($query->rows as $row) {
			$name = isset($row['COLUMN_NAME']) ? $row['COLUMN_NAME'] : '';

			if (in_array($name, $wanted, true)) {
				$present[] = $name;
			}
		}

		self::$cn_columns = $present;

		return self::$cn_columns;
	}

	private function saveSetting($key, $value) {
		if (!$this->settingKeyAllowed($key)) {
			return;
		}

		$code = 'module_shippingdata_plus';
		$query = $this->db->query("SELECT `value` FROM `" . DB_PREFIX . "setting` WHERE `store_id` = '0' AND `code` = '" . $this->db->escape($code) . "' AND `key` = '" . $this->db->escape($key) . "'");

		if ($query->num_rows) {
			$this->db->query("UPDATE `" . DB_PREFIX . "setting` SET `value` = '" . $this->db->escape($value) . "', `serialized` = '0' WHERE `store_id` = '0' AND `code` = '" . $this->db->escape($code) . "' AND `key` = '" . $this->db->escape($key) . "'");
		} else {
			$this->db->query("INSERT INTO `" . DB_PREFIX . "setting` SET `store_id` = '0', `code` = '" . $this->db->escape($code) . "', `key` = '" . $this->db->escape($key) . "', `value` = '" . $this->db->escape($value) . "', `serialized` = '0'");
		}
	}

	private function settingKeyAllowed($key) {
		foreach ($this->carrierMap() as $carrier => $tables) {
			if ($key === 'module_shippingdata_plus_backup_' . $carrier) {
				return true;
			}

			if ($key === 'module_shippingdata_plus_navbar_' . $carrier . '_cities' || $key === 'module_shippingdata_plus_navbar_' . $carrier . '_departments') {
				return true;
			}
		}

		return false;
	}

	// The storefront constructs this admin model, so DIR_LANGUAGE points at
	// catalog/language and customer phrases are loaded from there.
	private function readLanguage($route) {
		$_ = array();

		if (!preg_match('/^[a-z0-9_\/]+$/', $route)) {
			return $_;
		}

		$dir = $this->languageDirectory();
		$code = $this->activeLanguageCode();
		$fallback = $dir . 'uk-ua/' . $route . '.php';
		$file = $dir . $code . '/' . $route . '.php';

		if (is_file($fallback)) {
			include($fallback);
		}

		if ($file !== $fallback && is_file($file)) {
			include($file);
		}

		return $_;
	}

	private function languageDirectory() {
		return rtrim(DIR_LANGUAGE, '/\\') . '/';
	}

	private function dropFreshCopies($tables) {
		foreach ($tables as $table) {
			$fresh = $this->physical($table, '__sdp_new');

			if ($fresh === '') {
				continue;
			}

			try {
				$this->db->query('DROP TABLE IF EXISTS ' . $fresh);
			} catch (Exception $e) {
			}
		}
	}

	private function keepSpare($tables) {
		foreach ($tables as $table) {
			$spare = $this->physical($table, '__sdp');
			$fresh = $this->physical($table, '__sdp_new');

			if ($spare === '' || $fresh === '') {
				continue;
			}

			try {
				if (!$this->tableExists(DB_PREFIX . $table . '__sdp') && $this->tableExists(DB_PREFIX . $table . '__sdp_new')) {
					$this->db->query('RENAME TABLE ' . $fresh . ' TO ' . $spare);
				} elseif ($this->tableExists(DB_PREFIX . $table . '__sdp')) {
					$this->db->query('DROP TABLE IF EXISTS ' . $fresh);
				}
			} catch (Exception $e) {
			}
		}
	}

	private function putAsideBack($tables) {
		foreach ($tables as $table) {
			$live = $this->physical($table, '');
			$aside = $this->physical($table, '__aside');

			if ($live === '' || $aside === '') {
				continue;
			}

			if ($this->tableExists(DB_PREFIX . $table) || !$this->tableExists(DB_PREFIX . $table . '__aside')) {
				continue;
			}

			try {
				$this->db->query('RENAME TABLE ' . $aside . ' TO ' . $live);
			} catch (Exception $e) {
			}
		}
	}

	private function activeLanguageCode() {
		if (defined('DIR_CATALOG')) {
			$code = $this->config->get('config_admin_language');
		} else {
			$code = $this->config->get('config_language');
		}

		$code = strtolower((string)$code);

		if (!preg_match('/^[a-z]{2}-[a-z]{2}$/', $code)) {
			return 'en-gb';
		}

		return $code;
	}
}

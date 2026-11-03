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

class ControllerExtensionModuleShippingdataPlus extends Controller {
	private $error = array();

	public function index() {
		$data = $this->load->language('extension/module/shippingdata_plus');
		$this->load->model('setting/setting');
		$this->load->model('extension/module/shippingdata_plus');

		$this->document->setTitle($this->language->get('heading_title'));

		if (($this->request->server['REQUEST_METHOD'] == 'POST') && $this->validate()) {
			$setting = $this->model_setting_setting->getSetting('shippingdata_plus');

			foreach ($this->settingKeys() as $key) {
				$setting[$key] = !empty($this->request->post[$key]) ? 1 : 0;
			}

			$this->model_setting_setting->editSetting('shippingdata_plus', $setting);

			$this->session->data['success'] = $this->language->get('text_success');

			$this->response->redirect($this->url->link('extension/extension', 'token=' . $this->session->data['token'] . '&type=module', true));
		}

		$data['error_warning'] = isset($this->error['warning']) ? $this->error['warning'] : '';

		$data['breadcrumbs'] = array();

		$data['breadcrumbs'][] = array(
			'text' => $this->language->get('text_home'),
			'href' => $this->url->link('common/dashboard', 'token=' . $this->session->data['token'], true)
		);

		$data['breadcrumbs'][] = array(
			'text' => $this->language->get('text_extension'),
			'href' => $this->url->link('extension/extension', 'token=' . $this->session->data['token'] . '&type=module', true)
		);

		$data['breadcrumbs'][] = array(
			'text' => $this->language->get('heading_title'),
			'href' => $this->url->link('extension/module/shippingdata_plus', 'token=' . $this->session->data['token'], true)
		);

		$data['action'] = $this->url->link('extension/module/shippingdata_plus', 'token=' . $this->session->data['token'], true);
		$data['cancel'] = $this->url->link('extension/extension', 'token=' . $this->session->data['token'] . '&type=module', true);
		$data['token'] = $this->session->data['token'];

		foreach ($this->settingKeys() as $key) {
			if (isset($this->request->post[$key])) {
				$data[$key] = $this->request->post[$key];
			} else {
				$data[$key] = $this->config->get($key);
			}
		}

		$data['carriers'] = $this->model_extension_module_shippingdata_plus->panels();

		$data['header'] = $this->load->controller('common/header');
		$data['column_left'] = $this->load->controller('common/column_left');
		$data['footer'] = $this->load->controller('common/footer');

		$this->response->setOutput($this->load->view('extension/module/shippingdata_plus', $data));
	}

	public function orders() {
		$this->load->language('extension/module/shippingdata_plus');

		// Reading TTNs needs sale/order access only. Backup, ping, and update
		// still go through allowModify().
		if (!$this->user->hasPermission('access', 'sale/order')) {
			$this->respond(array('error' => $this->language->get('error_permission')));

			return;
		}

		$this->load->model('extension/module/shippingdata_plus');

		$raw = array();

		if (isset($this->request->post['order_id']) && is_array($this->request->post['order_id'])) {
			$raw = $this->request->post['order_id'];
		}

		$orders = $this->model_extension_module_shippingdata_plus->getOrdersTtn($raw);

		if (!$orders) {
			$orders = new stdClass();
		}

		$this->respond(array('orders' => $orders));
	}

	public function ping() {
		$this->load->language('extension/module/shippingdata_plus');

		if (!$this->allowModify()) {
			return;
		}

		$this->load->model('extension/module/shippingdata_plus');

		$carrier = isset($this->request->get['carrier']) ? (string)$this->request->get['carrier'] : '';

		if (!$this->model_extension_module_shippingdata_plus->isCarrier($carrier)) {
			$this->respond(array('error' => $this->language->get('error_carrier')));

			return;
		}

		$helper = $this->loadHelper($carrier);
		$started = microtime(true);
		$ok = false;

		try {
			$ok = $this->pingCarrier($carrier, $helper);
		} catch (Exception $e) {
			$ok = false;
		}

		$ms = (int)max(0, round((microtime(true) - $started) * 1000));
		$color = $this->pingColor($ok, $ms);
		$result = array(
			'carrier' => $carrier,
			'ok'      => $ok,
			'ms'      => $ms,
			'color'   => $color
		);

		if (!$ok) {
			$result['error'] = $this->language->get('error_ping');
		}

		$this->respond($result);
	}

	public function update() {
		$this->load->language('extension/module/shippingdata_plus');

		if (!$this->allowModify()) {
			return;
		}

		$this->load->model('extension/module/shippingdata_plus');
		$model = $this->model_extension_module_shippingdata_plus;
		$carrier = isset($this->request->get['carrier']) ? (string)$this->request->get['carrier'] : '';
		$type = isset($this->request->get['type']) ? (string)$this->request->get['type'] : '';

		if (!$model->isCarrier($carrier)) {
			$this->respond(array('error' => $this->language->get('error_carrier')));

			return;
		}

		if (!$model->isType($type)) {
			$this->respond(array('error' => $this->language->get('error_type')));

			return;
		}

		set_time_limit(0);

		$before = $model->countType($carrier, $type);
		$helper = $this->loadHelper($carrier);
		$result = false;

		try {
			$result = $helper->update($type);
		} catch (Exception $e) {
			$result = false;
		}

		$after = $model->countType($carrier, $type);

		if ($result === false) {
			$this->respond(array(
				'carrier' => $carrier,
				'type'    => $type,
				'count'   => $after,
				'error'   => $this->language->get('error_update')
			));

			return;
		}

		$model->saveNavbarCount($carrier, $type, $after);

		$this->respond(array(
			'carrier' => $carrier,
			'type'    => $type,
			'count'   => $after,
			'delta'   => $after - $before
		));
	}

	public function backup() {
		$this->load->language('extension/module/shippingdata_plus');

		if (!$this->allowModify()) {
			return;
		}

		set_time_limit(0);
		$this->load->model('extension/module/shippingdata_plus');

		$carrier = isset($this->request->post['carrier']) ? (string)$this->request->post['carrier'] : '';
		$result = $this->model_extension_module_shippingdata_plus->backup($carrier);

		$this->respondAction($result);
	}

	public function restore() {
		$this->load->language('extension/module/shippingdata_plus');

		if (!$this->allowModify()) {
			return;
		}

		set_time_limit(0);
		$this->load->model('extension/module/shippingdata_plus');

		$carrier = isset($this->request->post['carrier']) ? (string)$this->request->post['carrier'] : '';
		$result = $this->model_extension_module_shippingdata_plus->restore($carrier);

		$this->respondAction($result);
	}

	public function install() {
		$this->load->model('setting/setting');

		$this->model_setting_setting->editSetting('shippingdata_plus', array(
			'shippingdata_plus_status'     => 0,
			'shippingdata_plus_order_list' => 1,
			'shippingdata_plus_order_info' => 1,
			'shippingdata_plus_account'    => 1,
			'shippingdata_plus_navbar'     => 1
		));
	}

	public function uninstall() {
		$this->load->model('setting/setting');
		$this->load->model('extension/module/shippingdata_plus');

		$this->model_extension_module_shippingdata_plus->dropShadows();
		$this->model_setting_setting->deleteSetting('shippingdata_plus');
	}

	protected function validate() {
		if (!$this->user->hasPermission('modify', 'extension/module/shippingdata_plus')) {
			$this->error['warning'] = $this->language->get('error_permission');
		}

		return !$this->error;
	}

	private function settingKeys() {
		return array(
			'shippingdata_plus_status',
			'shippingdata_plus_order_list',
			'shippingdata_plus_order_info',
			'shippingdata_plus_account',
			'shippingdata_plus_navbar'
		);
	}

	// Unlike orders(), backup, ping, and update are not granted by sale/order access.
	private function allowModify() {
		if ($this->user->hasPermission('modify', 'extension/module/shippingdata_plus')) {
			return true;
		}

		$this->respond(array('error' => $this->language->get('error_permission')));

		return false;
	}

	private function respondAction($result) {
		if (!empty($result['error'])) {
			$this->respond(array('error' => $this->language->get($result['error'])));

			return;
		}

		$this->respond($result);
	}

	private function respond($data) {
		$this->response->addHeader('Content-Type: application/json');
		$this->response->setOutput(json_encode($data));
	}

	private function loadHelper($code) {
		$classes = array(
			'novaposhta'       => 'NovaPoshta',
			'ukrposhta'        => 'UkrPoshta',
			'meest'            => 'Meest',
			'rozetka_delivery' => 'RozetkaDelivery'
		);

		if (!isset($classes[$code])) {
			return null;
		}

		require_once(DIR_SYSTEM . 'helper/' . $code . '.php');

		$class = $classes[$code];
		$helper = new $class($this->registry);
		$this->registry->set($code, $helper);

		return $helper;
	}

	private function pingCarrier($code, $helper) {
		if ($code === 'novaposhta') {
			return (bool)$helper->apiRequest('Common', 'getServiceTypes');
		}

		if ($code === 'ukrposhta') {
			$helper->setApp('address-classifier-ws');

			return (bool)$helper->apiRequest('get_regions_by_region_ua');
		}

		if ($code === 'meest') {
			return (bool)$helper->getSenderData();
		}

		if ($code === 'rozetka_delivery') {
			return (bool)$helper->verify();
		}

		return false;
	}

	private function pingColor($ok, $ms) {
		if (!$ok || $ms > 1000) {
			return 'danger';
		}

		if ($ms >= 400) {
			return 'warning';
		}

		return 'success';
	}
}

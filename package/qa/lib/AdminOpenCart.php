<?php
/**
 * Minimal OpenCart 3 admin registry for CN form/list CLI probes.
 */
class QaAdminOpenCart {
	/** @var Registry */
	public $registry;

	public static function create($storeRoot) {
		$storeRoot = rtrim(str_replace('\\', '/', $storeRoot), '/');

		$_SERVER['HTTP_HOST'] = 'oc3';
		$_SERVER['SERVER_NAME'] = 'oc3';
		$_SERVER['SERVER_PORT'] = '80';
		$_SERVER['REQUEST_METHOD'] = 'GET';
		$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
		$_SERVER['REQUEST_URI'] = '/admin/';
		$_SERVER['SCRIPT_NAME'] = '/admin/index.php';
		$_SERVER['SERVER_PROTOCOL'] = 'HTTP/1.1';
		$_SERVER['HTTPS'] = '';
		$_GET = array();
		$_POST = array();
		$_COOKIE = array();
		$_FILES = array();

		chdir($storeRoot . '/admin');

		if (!defined('VERSION')) {
			define('VERSION', '3.0.4.1');
		}

		require_once $storeRoot . '/admin/config.php';
		require_once DIR_SYSTEM . 'startup.php';

		$registry = new Registry();

		$config = new Config();
		$config->load('default');
		$config->load('admin');
		$registry->set('config', $config);

		$log = new Log($config->get('error_filename'));
		$registry->set('log', $log);

		$event = new Event($registry);
		$registry->set('event', $event);

		$loader = new Loader($registry);
		$registry->set('load', $loader);

		$request = new Request();
		$registry->set('request', $request);

		$response = new Response();
		$registry->set('response', $response);

		$db = new DB(
			$config->get('db_engine'),
			$config->get('db_hostname'),
			$config->get('db_username'),
			$config->get('db_password'),
			$config->get('db_database'),
			$config->get('db_port')
		);
		$registry->set('db', $db);

		$session = new Session($config->get('session_engine'), $registry);
		$registry->set('session', $session);
		$session->start();
		$session->data['user_token'] = 'qa-matrix-cli';

		$registry->set('cache', new Cache($config->get('cache_engine'), $config->get('cache_expire')));

		require_once DIR_APPLICATION . 'controller/startup/startup.php';
		$startup = new ControllerStartupStartup($registry);
		$startup->index();

		$registry->set('user', new Cart\User($registry));

		$user = $registry->get('user');
		if (!$user->login('admin', 'admin')) {
			$q = $db->query("SELECT user_id FROM `" . DB_PREFIX . "user` WHERE username = 'admin' AND status = '1' LIMIT 1");
			if ($q->num_rows) {
				$session->data['user_id'] = (int) $q->row['user_id'];
				$registry->set('user', new Cart\User($registry));
			}
		}

		$registry->set('url', new Url(HTTP_SERVER, HTTPS_SERVER));
		$registry->set('document', new Document());

		$self = new self();
		$self->registry = $registry;

		return $self;
	}

	public function clearCache() {
		$dir = DIR_CACHE;
		if (is_dir($dir)) {
			foreach (glob($dir . 'cache.*') ?: array() as $file) {
				@unlink($file);
			}
		}
	}
}

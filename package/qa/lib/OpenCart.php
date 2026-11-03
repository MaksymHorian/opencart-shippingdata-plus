<?php
/**
 * Minimal OpenCart 3 catalog registry for CLI quote probes.
 * Does not dispatch the front controller.
 */
class QaOpenCart {
	/** @var Registry */
	public $registry;

	public static function create($storeRoot) {
		$storeRoot = rtrim(str_replace('\\', '/', $storeRoot), '/');

		$_SERVER['HTTP_HOST'] = 'oc3';
		$_SERVER['SERVER_NAME'] = 'oc3';
		$_SERVER['SERVER_PORT'] = '80';
		$_SERVER['REQUEST_METHOD'] = 'GET';
		$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
		$_SERVER['REQUEST_URI'] = '/';
		$_SERVER['SCRIPT_NAME'] = '/index.php';
		$_SERVER['SERVER_PROTOCOL'] = 'HTTP/1.1';
		$_SERVER['HTTPS'] = '';
		$_GET = array();
		$_POST = array();
		$_COOKIE = array();
		$_FILES = array();

		chdir($storeRoot);

		if (!defined('VERSION')) {
			define('VERSION', '3.0.4.1');
		}

		require_once $storeRoot . '/config.php';
		require_once DIR_SYSTEM . 'startup.php';

		$application_config = 'catalog';

		$registry = new Registry();

		$config = new Config();
		$config->load('default');
		$config->load($application_config);
		$registry->set('config', $config);

		$log = new Log($config->get('error_filename'));
		$registry->set('log', $log);

		$event = new Event($registry);
		$registry->set('event', $event);

		$loader = new Loader($registry);
		$registry->set('load', $loader);

		$registry->set('request', new Request());

		$response = new Response();
		$response->addHeader('Content-Type: application/json; charset=utf-8');
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

		$registry->set('cache', new Cache($config->get('cache_engine'), $config->get('cache_expire')));

		require_once DIR_APPLICATION . 'controller/startup/startup.php';
		$startup = new ControllerStartupStartup($registry);
		$startup->index();

		$self = new self();
		$self->registry = $registry;

		return $self;
	}

	public function clearCache() {
		$cache = $this->registry->get('cache');
		if ($cache && method_exists($cache, 'delete')) {
			$cache->delete('currency');
		}

		$dir = DIR_CACHE;
		if (is_dir($dir)) {
			foreach (glob($dir . 'cache.*') ?: array() as $file) {
				@unlink($file);
			}
		}
	}
}

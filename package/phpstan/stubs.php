<?php
/**
 * Minimal OpenCart 3 stubs for PHPStan (extension sandbox analysis only).
 */
define('VERSION', '3.0.4.1');
define('DIR_APPLICATION', '');
define('DIR_SYSTEM', dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'system' . DIRECTORY_SEPARATOR);
define('DIR_IMAGE', '');
define('DIR_STORAGE', '');
define('DIR_LANGUAGE', '');
define('DIR_TEMPLATE', '');
define('DIR_CONFIG', '');
define('DIR_CACHE', '');
define('DIR_UPLOAD', DIR_SYSTEM . 'storage' . DIRECTORY_SEPARATOR . 'upload' . DIRECTORY_SEPARATOR);
define('DB_PREFIX', 'oc_');
define('DB_DATABASE', 'opencart');
define('HTTP_SERVER', 'http://localhost/');
define('HTTPS_SERVER', 'https://localhost/');

class Registry {
    public function get($key) {}
    public function set($key, $value) {}
    public function has($key) {}
}

class Config {
    public function get($key) {}
    public function set($key, $value) {}
    public function has($key) {}
}

/*
 * Carrier helpers are pushed into the registry by each module and reached as $this->{name}.
 * Typing them here keeps the dead-public-method gate working without annotations in module
 * files: without a concrete type every helper method would look unused.
 */
trait OcmaxCarrierHelpers {
    /** @var Meest */
    protected $meest;
    /** @var NovaPoshta */
    protected $novaposhta;
    /** @var UkrPoshta */
    protected $ukrposhta;
    /** @var RozetkaDelivery */
    protected $rozetka_delivery;
}

class Model {
    use OcmaxCarrierHelpers;

    protected $registry;
    protected $db;
    protected $config;
    protected $load;
    protected $language;
    protected $request;
    protected $session;
    protected $cache;
    protected $log;
    protected $event;
    protected $url;
    protected $document;
    protected $customer;
    protected $cart;
    protected $tax;
    protected $currency;
    protected $weight;
    protected $length;
    protected $user;

    public function __construct($registry) {}
    public function __get($key) {}
}

class Controller {
    use OcmaxCarrierHelpers;

    protected $registry;
    protected $load;
    protected $config;
    protected $language;
    protected $request;
    protected $response;
    protected $session;
    protected $db;
    protected $document;
    protected $url;
    protected $user;
    protected $cart;
    protected $tax;
    protected $currency;
    protected $weight;
    protected $length;

    public function __construct($registry) {}
    public function __get($key) {}
}

class Loader {
    public function model($route) {}
    public function language($route) {}
    public function view($route, $data = array()) {}
    public function library($route) {}
}

class DB {
    public function query($sql) {}
    public function escape($value) {}
}

class Request {
    public $get = array();
    public $post = array();
    public $server = array();
    public $cookie = array();
}

class Response {
    public function addHeader($header) {}
    public function setOutput($output) {}
}

class Session {
    public $data = array();
    public function start($session_id = '') {}
    public function getId() {}
}

class Cache {
    public function delete($key) {}
}

class Log {
    public function write($message) {}
}

class Event {
    public function register($trigger, $action, $priority = 0) {}
    public function trigger($event, $args = array()) {}
}

class Url {
    public function link($route, $args = '', $secure = false) {}
}

class Document {
    public function setTitle($title) {}
}

class Encryption {}

class Action {
    public function __construct($route, $args = array()) {}
    public function getId() {}
    public function execute($registry, array $args = array()) {}
}

function modification($filename) {
    return $filename;
}

function utf8_strlen($string) {
    return strlen($string);
}

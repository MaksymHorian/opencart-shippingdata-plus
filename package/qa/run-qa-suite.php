<?php
/**
 * Unified QA suite runner: cart (getQuote), cn-form, cn-list.
 *
 * Usage:
 *   php run-qa-suite.php --module=meest [--suite=all|cart|cn-form|cn-list] [--layer=all]
 */
$opts = getopt('', array('module:', 'suite::', 'layer::', 'store::', 'help'));

if (isset($opts['help']) || empty($opts['module'])) {
	fwrite(STDERR, "Usage: php run-qa-suite.php --module=meest [--suite=all|cart|cn-form|cn-list] [--layer=all]\n");
	exit(2);
}

$module = preg_replace('/[^a-z0-9_]/', '', $opts['module']);
$suite = isset($opts['suite']) ? $opts['suite'] : 'all';
$layer = isset($opts['layer']) ? $opts['layer'] : 'all';
$store = isset($opts['store']) ? $opts['store'] : dirname(dirname(__DIR__));

if ($suite === 'all') {
	$phpBin = defined('PHP_BINARY') ? PHP_BINARY : 'php';
	$suiteNames = array('cart', 'cn-form', 'cn-list');
	$reports = array();
	$allOk = true;

	foreach ($suiteNames as $name) {
		$cmd = escapeshellarg($phpBin) . ' ' . escapeshellarg(__FILE__)
			. ' --module=' . escapeshellarg($module)
			. ' --suite=' . escapeshellarg($name)
			. ' --layer=' . escapeshellarg($layer)
			. ' --store=' . escapeshellarg($store);

		$output = array();
		$code = 0;
		exec($cmd . ' 2>&1', $output, $code);

		$outputStr = implode("\n", $output);
		$start = strpos($outputStr, '{');
		$parsed = ($start !== false) ? json_decode(substr($outputStr, $start), true) : null;

		if (!$parsed || empty($parsed['report']) || !is_file($parsed['report'])) {
			$reports[$name] = array(
				'ok' => false,
				'skipped' => true,
				'error' => 'Subprocess failed: ' . implode("\n", array_slice($output, -5)),
				'exit_code' => $code
			);
			$allOk = false;
			continue;
		}

		$full = json_decode(file_get_contents($parsed['report']), true);
		$reports[$name] = !empty($full['reports'][$name]) ? $full['reports'][$name] : array('ok' => false, 'error' => 'missing report section');
		if (empty($reports[$name]['ok'])) {
			$allOk = false;
		}
	}

	qa_suite_write_summary($module, 'all', $reports, $allOk);
	exit($allOk ? 0 : 1);
}

require_once __DIR__ . '/lib/SchemaLoader.php';
require_once __DIR__ . '/lib/OpenCart.php';
require_once __DIR__ . '/lib/AdminOpenCart.php';
require_once __DIR__ . '/lib/SettingsStore.php';
require_once __DIR__ . '/lib/MatrixRunner.php';
require_once __DIR__ . '/lib/CnFormRunner.php';
require_once __DIR__ . '/lib/CnListRunner.php';

$schemasDir = __DIR__ . '/schemas';

try {
	$schema = QaSchemaLoader::load($module, $suite, $schemasDir);
} catch (RuntimeException $e) {
	fwrite(STDERR, $e->getMessage() . PHP_EOL);
	exit(2);
}

$reports = array();

if ($suite === 'cart') {
	$boot = QaOpenCart::create($store);
	$storeDb = new QaSettingsStore($boot->registry->get('db'), DB_PREFIX);
	$reports[$suite] = (new QaMatrixRunner($boot, $storeDb, $schema))->run($layer);
} elseif ($suite === 'cn-form') {
	$boot = QaAdminOpenCart::create($store);
	$reports[$suite] = (new QaCnFormRunner($boot, $schema))->run();
} elseif ($suite === 'cn-list') {
	$boot = QaAdminOpenCart::create($store);
	$storeDb = new QaSettingsStore($boot->registry->get('db'), DB_PREFIX);
	$reports[$suite] = (new QaCnListRunner($boot, $storeDb, $schema))->run();
} else {
	fwrite(STDERR, "Unknown suite: {$suite}\n");
	exit(2);
}

$allOk = !empty($reports[$suite]['ok']);
qa_suite_write_summary($module, $suite, $reports, $allOk);
exit($allOk ? 0 : 1);

function qa_suite_write_summary($module, $suite, array $reports, $allOk) {
	$outDir = __DIR__ . '/reports';
	if (!is_dir($outDir)) {
		mkdir($outDir, 0777, true);
	}

	$outFile = $outDir . '/' . $module . '-suite-' . date('Ymd-His') . '.json';
	file_put_contents($outFile, json_encode(array(
		'module' => $module,
		'suite' => $suite,
		'ok' => $allOk,
		'reports' => $reports,
		'finished_at' => date('c')
	), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

	$summary = array(
		'ok' => $allOk,
		'report' => $outFile,
		'suites' => array()
	);

	foreach ($reports as $sname => $rep) {
		if (!empty($rep['skipped'])) {
			$summary['suites'][$sname] = array('skipped' => true, 'error' => $rep['error']);
			continue;
		}

		$cov = isset($rep['coverage']) ? $rep['coverage'] : array();
		$summary['suites'][$sname] = array(
			'ok' => !empty($rep['ok']),
			'coverage' => $cov,
			'failed' => array_values(array_filter(isset($rep['cases']) ? $rep['cases'] : array(), function ($c) {
				return isset($c['status']) && $c['status'] === 'fail';
			}))
		);
	}

	echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
}

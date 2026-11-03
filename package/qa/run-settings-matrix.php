<?php
/**
 * Cart/getQuote matrix entry (legacy name). Delegates to run-qa-suite.php --suite=cart.
 */
$argv = $_SERVER['argv'];
$hasSuite = false;
foreach ($argv as $a) {
	if (strpos($a, '--suite=') === 0) {
		$hasSuite = true;
		break;
	}
}
if (!$hasSuite) {
	$argv[] = '--suite=cart';
}
$_SERVER['argv'] = $argv;
require __DIR__ . '/run-qa-suite.php';

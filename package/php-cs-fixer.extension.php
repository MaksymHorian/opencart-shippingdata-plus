<?php

return (new PhpCsFixer\Config())
    ->setRules([
        'array_syntax' => ['syntax' => 'short'],
        'no_trailing_whitespace' => true,
        'no_whitespace_in_blank_line' => true,
        'single_blank_line_at_eof' => true,
        'binary_operator_spaces' => ['default' => 'single_space'],
    ]);

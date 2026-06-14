<?php

namespace Moodorama;

/**
 * Windows PHP often ships with OPENSSL_CONF pointing at a missing file.
 * OpenSSL reads that variable at process start, so putenv() in PHP is too late.
 */
final class OpenSslConfig
{
    public static function findConfigFile(): ?string
    {
        $candidates = [
            dirname(PHP_BINARY) . DIRECTORY_SEPARATOR . 'extras'
                . DIRECTORY_SEPARATOR . 'ssl' . DIRECTORY_SEPARATOR . 'openssl.cnf',
        ];

        foreach ($candidates as $path) {
            if (is_file($path)) {
                return $path;
            }
        }

        return null;
    }

    public static function environmentIsReady(): bool
    {
        $current = getenv('OPENSSL_CONF');
        return is_string($current) && $current !== '' && is_file($current);
    }

    /** Re-run the current CLI script with OPENSSL_CONF set (once). */
    public static function ensureCliEnvironment(array $argv): void
    {
        if (PHP_SAPI !== 'cli' || getenv('MOODORAMA_OPENSSL_REEXEC') === '1') {
            return;
        }

        if (self::environmentIsReady()) {
            return;
        }

        $conf = self::findConfigFile();
        if ($conf === null || $argv === []) {
            return;
        }

        $env = self::environmentWithOpenSslConf($conf);
        $env['MOODORAMA_OPENSSL_REEXEC'] = '1';

        $command = array_merge([PHP_BINARY], $argv);
        $process = proc_open(
            $command,
            [
                0 => STDIN,
                1 => STDOUT,
                2 => STDERR,
            ],
            $pipes,
            null,
            $env
        );

        if (!is_resource($process)) {
            return;
        }

        exit(proc_close($process));
    }

    /** @return array<string, string> */
    private static function environmentWithOpenSslConf(string $conf): array
    {
        $env = [];
        foreach ($_SERVER as $key => $value) {
            if (!is_string($value) || !self::isEnvironmentKey($key)) {
                continue;
            }
            $env[$key] = $value;
        }

        $env['OPENSSL_CONF'] = $conf;

        return $env;
    }

    private static function isEnvironmentKey(string $key): bool
    {
        return $key !== 'argc'
            && $key !== 'argv'
            && !str_starts_with($key, 'HTTP_')
            && $key !== 'REQUEST_METHOD'
            && $key !== 'REQUEST_URI';
    }
}

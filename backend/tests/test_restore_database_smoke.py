from subsmarket.ops.restore_database_smoke import requisite_format


def test_requisite_format_distinguishes_all_supported_crypto_versions() -> None:
    assert requisite_format("v3:encrypted") == "v3"
    assert requisite_format("v2:salt:encrypted") == "v2"
    assert requisite_format("legacy-encrypted") == "legacy"

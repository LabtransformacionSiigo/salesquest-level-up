import unittest
from pathlib import Path

from .catalog import Product, load_catalog
from .price_list import resolve_code, update_price_list

ROOT = Path(__file__).resolve().parents[2]
CATALOG_XLSX = ROOT / "data" / "productos" / "Productos_LATAM.xlsx"


def _catalog(*codes):
    return {c: Product(codigo=c, nombre=f"Producto {c}") for c in codes}


class ResolveCodeTest(unittest.TestCase):
    def test_existing_code_is_kept(self):
        self.assertEqual(resolve_code("9380001000001", _catalog("9380001000001")), "9380001000001")

    def test_restores_leading_zeros(self):
        self.assertEqual(resolve_code("20001000006", _catalog("0020001000006")), "0020001000006")

    def test_unknown_code(self):
        self.assertIsNone(resolve_code("123", _catalog("0020001000006")))

    def test_alphanumeric_codes_are_not_padded(self):
        self.assertIsNone(resolve_code("UY1", _catalog("0000000000UY1")))


class UpdatePriceListTest(unittest.TestCase):
    def test_updates_products_and_nomina_without_mutating_input(self):
        original = {
            "fileName": "x.xlsx",
            "products": [{"codigo": "20001000001", "precio2026": 1}, {"codigo": "9380001000001"}],
            "nominaAntigua": [{"codigo": "9450002000014"}],
        }
        updated, report = update_price_list(original, _catalog("0020001000001", "9380001000001", "9450002000014"))
        self.assertEqual(updated["products"][0], {"codigo": "0020001000001", "precio2026": 1})
        self.assertEqual(original["products"][0]["codigo"], "20001000001")
        self.assertEqual((report.total, report.unchanged, len(report.changes)), (3, 2, 1))
        self.assertTrue(report.ok)

    def test_unresolved_codes_fail(self):
        _, report = update_price_list({"products": [{"codigo": "999"}]}, _catalog("0020001000001"))
        self.assertFalse(report.ok)
        self.assertEqual(report.unresolved, [("products", 0, "999")])
        self.assertIn("`999`", report.to_markdown())

    def test_rejects_invalid_price_list(self):
        with self.assertRaises(ValueError):
            update_price_list({"items": []}, _catalog())


@unittest.skipUnless(CATALOG_XLSX.exists(), "catálogo no disponible")
class CatalogFileTest(unittest.TestCase):
    def test_official_catalog_loads_codes_as_text(self):
        catalog = load_catalog(CATALOG_XLSX)
        self.assertGreater(len(catalog), 5000)
        self.assertIn("0020001000001", catalog)  # conserva ceros iniciales
        self.assertTrue(all(isinstance(c, str) for c in catalog))


if __name__ == "__main__":
    unittest.main()

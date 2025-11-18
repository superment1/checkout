from app_stripe_webhook import PRODUCT_ITEM_MAP

def build_items_from_metadata(md: dict):
    items = []
    i = 1
    while md.get(f"item_{i}_sku"):
        items.append({
            "item": md.get(f"item_{i}_sku"),
            "quantity": int(md.get(f"item_{i}_qty", 1)),
        })
        i += 1
    product_id = md.get("product_id")
    if not items:
            base = PRODUCT_ITEM_MAP.get(product_id)
            if base:
                items = [{
                    "item": base["sku"],
                    "quantity": base["qty"],
                }]
            else:
                items = [{
                    "item": product_id or "UNKNOWN",
                    "quantity": 1,
                }]

    return items

# ---- TESTE REAL ----
metadata = { "product_id": "prod_SbKa8ag01A2TGX" } 
items = build_items_from_metadata(metadata)

print("\n=== ITEMS GERADO PELO MAP ===")
print(items)

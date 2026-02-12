import json
from app_stripe_webhook import send_order_to_cartrover
import os
from dotenv import load_dotenv

load_dotenv()


CARTROVER_USER = os.getenv("CARTROVER_API_USER")
CARTROVER_KEY = os.getenv("CARTROVER_API_KEY")
CARTROVER_BASE = os.getenv("CARTROVER_BASE_URL", "https://api.cartrover.com/v1").rstrip("/")

def main():
    print("=== TESTE CARTROVER LOCAL ===")

    # Só pra garantir que os envs estão carregados
    print("CARTROVER_BASE:", CARTROVER_BASE)
    print("CARTROVER_USER está setado?", bool(CARTROVER_USER))
    print("CARTROVER_KEY está setado?", bool(CARTROVER_KEY))

    order_payload = {
        "cust_ref": "TEST_LOCAL_PI_123",
        "ship_company": "Teste Local Extensiv",
        "ship_address_1": "Rua do Teste, 123",
        "ship_city": "São Luís",
        "ship_state": "MA",
        "ship_zip": "65000-000",
        "ship_country": "BRA",
        "ship_is_billing": True,
        "items": [
            {
                "item": "SPRSLP",   # SKU que você quer testar
                "quantity": 3,
            }
        ],
    }

    print("\n[TEST] Payload a enviar:")
    print(json.dumps(order_payload, ensure_ascii=False, indent=2))

    resp = send_order_to_cartrover(order_payload)

    print("\n[TEST] Resposta da Extensiv (objeto requests):")
    print("Status:", getattr(resp, "status_code", "sem status"))
    print("Body:", getattr(resp, "text", resp))

if __name__ == "__main__":
    main()

# from app_stripe_webhook import PRODUCT_ITEM_MAP

# def build_items_from_metadata(md: dict):
#     items = []
#     i = 1
#     while md.get(f"item_{i}_sku"):
#         items.append({
#             "item": md.get(f"item_{i}_sku"),
#             "quantity": int(md.get(f"item_{i}_qty", 1)),
#         })
#         i += 1
#     product_id = md.get("product_id")
#     if not items:
#             base = PRODUCT_ITEM_MAP.get(product_id)
#             if base:
#                 items = [{
#                     "item": base["sku"],
#                     "quantity": base["qty"],
#                 }]
#             else:
#                 items = [{
#                     "item": product_id or "UNKNOWN",
#                     "quantity": 1,
#                 }]

#     return items

# # ---- TESTE REAL ----
# metadata = { "product_id": "prod_SbKa8ag01A2TGX" } 
# items = build_items_from_metadata(metadata)

# print("\n=== ITEMS GERADO PELO MAP ===")
# print(items)

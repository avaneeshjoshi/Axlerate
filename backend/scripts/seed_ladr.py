import sys
import os

# This tells Python to look in the current folder for your modules
sys.path.append(os.getcwd())

from backend.app.database.vector_store import add_to_db

# Real data from Linear Algebra Done Right
ladr_data = [
    {
        "text": "Definition 1.19: A vector space is a set V with addition and scalar multiplication.",
        "meta": {"id": "1.19", "type": "definition"}
    },
    {
        "text": "Theorem 1.34: A subset U of V is a subspace if it contains the zero vector and is closed under addition/multiplication.",
        "meta": {"id": "1.34", "type": "theorem"}
    }
]

print("--- BUILDING THE DATABASE ---")
for item in ladr_data:
    add_to_db(item["text"], item["meta"])
    print(f"Added {item['meta']['id']} to the vector database.")
print("--- DATABASE BUILT ---")
import os
import sys

# Ensure backend is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.database.vector_store import add_to_db

def run_ingestion():
    raw_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/raw/axioms.txt"))
    
    if not os.path.exists(raw_path):
        print(f"File not found: {raw_path}")
        return

    with open(raw_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Split by the --- delimiter
    chunks = content.split("---")
    
    for chunk in chunks:
        text = chunk.strip()
        if text:
            # We pass the text and metadata to your existing vector_store function
            add_to_db(text, {"source": "Linear Algebra Done Right"})
            print(f"Ingested: {text[:40]}...")

if __name__ == "__main__":
    run_ingestion()
"""Vector store for the Mathlib declaration index (the Lemma DB).

Embeds the records from mathlib_index_preview.json into their own Chroma
collection (separate from the LADR chat collection) so the proof agent can
retrieve candidate lemmas semantically. Falls back to lexical search over the
raw JSON when the collection hasn't been built yet.
"""
from __future__ import annotations

from langchain_chroma import Chroma

from .mathlib_index import lexical_search, load_index
from .vector_store import embeddings, persistent_client

COLLECTION_NAME = "mathlib_collection"
BATCH_SIZE = 256

def _make_db() -> Chroma:
    return Chroma(
        client=persistent_client,
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
    )


mathlib_db = _make_db()


def store_size() -> int:
    return persistent_client.get_or_create_collection(COLLECTION_NAME).count()


def build_store(force: bool = False) -> int:
    """Embed the whole Mathlib index into Chroma. Idempotent unless force."""
    records = load_index()
    if not records:
        raise FileNotFoundError("mathlib_index_preview.json missing — run backend/scripts/index_mathlib.py first")

    if force:
        global mathlib_db
        try:
            persistent_client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass
        # the old wrapper is bound to the deleted collection's UUID —
        # rebind to a freshly created collection
        mathlib_db = _make_db()

    existing = store_size()
    if existing >= len(records):
        return existing

    for start in range(existing, len(records), BATCH_SIZE):
        batch = records[start : start + BATCH_SIZE]
        mathlib_db.add_texts(
            texts=[record["search_text"] for record in batch],
            metadatas=[
                {
                    "name": record["name_guess"],
                    "kind": record["kind"],
                    "module": record["module"],
                    "statement": record["statement"],
                }
                for record in batch
            ],
            ids=[f"{record['module']}:{record['name_guess']}:{record['line_start']}" for record in batch],
        )
        print(f"Embedded {min(start + BATCH_SIZE, len(records))}/{len(records)} declarations")

    return store_size()


def search_mathlib(query: str, k: int = 5) -> list[dict]:
    """Return the k most relevant lemmas as {name, kind, statement} dicts."""
    if store_size() == 0:
        return [
            {
                "name": record["name_guess"],
                "kind": record["kind"],
                "statement": record["statement"],
            }
            for record in lexical_search(query, k)
        ]

    documents = mathlib_db.similarity_search(query, k=k)
    return [
        {
            "name": doc.metadata.get("name", ""),
            "kind": doc.metadata.get("kind", ""),
            "statement": doc.metadata.get("statement", ""),
        }
        for doc in documents
    ]


if __name__ == "__main__":
    total = build_store()
    print(f"Mathlib store ready with {total} declarations")
    for hit in search_mathlib("intersection of sets is commutative"):
        print(f"- {hit['name']}: {hit['statement'][:80]}")

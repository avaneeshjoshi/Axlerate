import os
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
import chromadb

# 1. Absolute path calculation
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../axlerate_db"))

# Ensure the directory exists so Chroma doesn't complain
os.makedirs(DB_PATH, exist_ok=True)

# 2. Setup Embeddings
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# 3. Initialize Vector DB
# Using the client directly is more robust for persistent storage
persistent_client = chromadb.PersistentClient(path=DB_PATH)

vector_db = Chroma(
    client=persistent_client,
    collection_name="ladr_collection",
    embedding_function=embeddings,
)

def add_to_db(text: str, metadata: dict):
    """Adds a single entry to the vector store."""
    vector_db.add_texts(texts=[text], metadatas=[metadata])

def search_db(query: str, k=2):
    """Returns the top k relevant strings from the DB."""
    results = vector_db.similarity_search(query, k=k)
    return [doc.page_content for doc in results]
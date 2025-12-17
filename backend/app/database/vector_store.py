import os
from langchain_chroma import Chroma
# CHANGE THIS IMPORT:
from langchain_huggingface import HuggingFaceEmbeddings 

DB_PATH = "./axlerate_db"

# This line stays the same, it just uses the new import from above
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

vector_db = Chroma(
    persist_directory=DB_PATH,
    embedding_function=embeddings,
    collection_name="ladr_collection"
)

def add_to_db(text: str, metadata: dict):
    vector_db.add_texts(texts=[text], metadatas=[metadata])

def search_db(query: str, k=2):
    results = vector_db.similarity_search(query, k=k)
    return [doc.page_content for doc in results]
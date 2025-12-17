import os
from dotenv import load_dotenv
# Make sure your import path matches your folder structure
from app.engine.graph_builder import axlerate_app

load_dotenv()

# Verify the key is actually loaded
if not os.getenv("GROQ_API_KEY"):
    raise ValueError("GROQ_API_KEY is not set in your .env file")

inputs = {"question": "What is a subspace?"}

# The graph handles its own LLM calls inside the nodes
for output in axlerate_app.stream(inputs):
    print(output)
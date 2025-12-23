import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Make sure your import path matches your folder structure
from app.engine.graph_builder import axlerate_app

load_dotenv()

# Verify the key is actually loaded
if not os.getenv("GROQ_API_KEY"):
    raise ValueError("GROQ_API_KEY is not set in your .env file")

app = FastAPI()

# Add CORS middleware to allow frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuestionRequest(BaseModel):
    question: str

class QuestionResponse(BaseModel):
    proof: str
    is_compliant: bool

@app.post("/api/question", response_model=QuestionResponse)
async def handle_question(request: QuestionRequest):
    """Handle a question from the frontend and return the proof."""
    try:
        inputs = {"question": request.question}
        
        # Use invoke to get the final state after the graph completes
        # The graph will run through all nodes (retrieve -> draft -> verify -> potentially retry)
        final_result = axlerate_app.invoke(inputs)
        
        # Extract the proof and compliance status from the final state
        proof = final_result.get("proof", "")
        is_compliant = final_result.get("is_compliant", False)
        
        return QuestionResponse(proof=proof, is_compliant=is_compliant)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error processing question: {str(e)}")
        print(f"Traceback: {error_details}")
        
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Error processing question: {str(e)}"
        )

@app.get("/")
async def root():
    return {"message": "Axlerate API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
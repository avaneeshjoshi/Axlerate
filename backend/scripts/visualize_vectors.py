import os
import sys
import numpy as np
import pandas as pd
import plotly.express as px
from sklearn.manifold import TSNE

# Path fix for your structure
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.abspath(os.path.join(current_dir, ".."))
sys.path.append(backend_root)

try:
    from app.database.vector_store import vector_db
except ImportError:
    print("Error: Could not find the 'app' module. Run from the backend folder.")
    sys.exit(1)

def visualize_interactive():
    print("Pulling axioms from ChromaDB...")
    
    # Get data
    data = vector_db.get(include=['embeddings', 'documents'])
    
    # FIX: Explicitly check for None or empty list using len()
    if data['embeddings'] is None or len(data['embeddings']) == 0:
        print("Database empty! Run your ingestion script first.")
        return

    print(f"Analyzing {len(data['embeddings'])} axioms for clusters...")
    
    # Ensure embeddings are in a format t-SNE understands (list of lists or 2D array)
    embeddings = np.array(data['embeddings'])
    
    # t-SNE configuration
    # Perplexity should be less than the number of samples
    n_samples = embeddings.shape[0]
    calc_perplexity = min(30, n_samples - 1) if n_samples > 1 else 1

    tsne = TSNE(
        n_components=2, 
        perplexity=calc_perplexity, 
        random_state=42,
        init='pca',
        learning_rate='auto'
    )
    
    coords = tsne.fit_transform(embeddings)

    # Create the data frame
    df = pd.DataFrame({
        'x': coords[:, 0],
        'y': coords[:, 1],
        'Axiom': [doc[:100] + "..." for doc in data['documents']], 
        'Full_Text': data['documents']
    })

    # Create the Interactive Plot
    fig = px.scatter(
        df, x='x', y='y',
        hover_name='Axiom',
        hover_data={'Full_Text': True, 'x': False, 'y': False},
        title="Axlerate: Axiom Knowledge Galaxy",
        template="plotly_dark"
    )

    fig.update_traces(
        marker=dict(size=12, opacity=0.7, line=dict(width=1, color='white'))
    )
    
    output_html = os.path.join(backend_root, "interactive_axiom_map.html")
    fig.write_html(output_html)
    
    print(f"Success! Map saved to: {output_html}")
    print("Opening in your browser...")
    fig.show()

if __name__ == "__main__":
    visualize_interactive()
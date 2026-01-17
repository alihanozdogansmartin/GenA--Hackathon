from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import chromadb
from chromadb.utils import embedding_functions
import httpx
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# SQLite Database
SQLALCHEMY_DATABASE_URL = "sqlite:///./callcenter.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    customer_message = Column(Text)
    agent_message = Column(Text)
    timestamp = Column(DateTime, default=datetime.now)
    sentiment_score = Column(Float, nullable=True)
    resolution_score = Column(Float, nullable=True)
    agent_performance = Column(Float, nullable=True)
    overall_score = Column(Float, nullable=True)
    is_resolved = Column(Boolean, default=False)
    customer_emotion = Column(String, nullable=True)
    response_time = Column(String, nullable=True)
    empathy_level = Column(String, nullable=True)
    category = Column(String, nullable=True)  # Problem kategorisi
    keywords = Column(Text, nullable=True)  # Anahtar kelimeler (JSON)

class DailyReport(Base):
    __tablename__ = "daily_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, index=True)
    total_conversations = Column(Integer)
    resolved_conversations = Column(Integer)
    avg_sentiment = Column(Float)
    avg_satisfaction = Column(Float)
    avg_performance = Column(Float)
    top_emotion = Column(String, nullable=True)
    top_category = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

# Create tables
Base.metadata.create_all(bind=engine)

# Practicus AI Embedding Configuration
api_key = os.getenv('GPT_OSS_API_KEY')
proxy_username = os.getenv('proxy_username')
proxy_password = os.getenv('proxy_password')

# Proxy ayarları - LLM ile aynı
proxy = f"http://{proxy_username}:{proxy_password}@172.31.53.99:8080/"
no_proxy = ".vodafone.local,localhost,172.31.0.0/16,172.24.0.0/16"

# Practicus AI embedding endpoint
embedding_base_url = "https://practicus.vodafone.local/models/model-gateway-ai-hackathon/latest/v1"

# OpenAI client for embeddings (şirket içi model için)
embedding_client = OpenAI(
    base_url=embedding_base_url,
    api_key=api_key,
    http_client=httpx.Client(
        verify=False,
        timeout=60.0
    )
)

# Custom Embedding Function for Practicus AI
class PracticusEmbeddingFunction(chromadb.EmbeddingFunction):
    def __call__(self, input: chromadb.Documents) -> chromadb.Embeddings:
        """Practicus AI embedding modelini kullanarak embedding oluştur"""
        try:
            # Practicus AI embedding endpoint'ini kullan
            response = embedding_client.embeddings.create(
                model="practicus/gemma-300m-hackathon",
                input=input
            )
            # Embedding'leri çıkar
            embeddings = [item.embedding for item in response.data]
            return embeddings
        except Exception as e:
            print(f"Embedding Error: {e}")
            # Fallback: basit dummy embedding (sadece test için)
            return [[0.0] * 384 for _ in input]

# ChromaDB for Vector Search (Ortak sorunları bulmak için)
chroma_client = chromadb.PersistentClient(path="./chroma_db")
sentence_transformer_ef = PracticusEmbeddingFunction()

# Collection for customer issues
try:
    # Önce var olan collection'ı al
    issues_collection = chroma_client.get_collection(
        name="customer_issues"
    )
    print("✅ Existing collection loaded")
except ValueError:
    # Embedding function conflict varsa, collection'ı sil ve yeniden oluştur
    print("⚠️ Embedding function conflict detected, recreating collection...")
    try:
        chroma_client.delete_collection(name="customer_issues")
    except:
        pass
    issues_collection = chroma_client.create_collection(
        name="customer_issues",
        embedding_function=sentence_transformer_ef,
        metadata={"description": "Customer complaints and issues"}
    )
    print("✅ Collection recreated with new embedding function")
except:
    # Collection yoksa oluştur
    try:
        chroma_client.delete_collection(name="customer_issues")
    except:
        pass
    issues_collection = chroma_client.create_collection(
        name="customer_issues",
        embedding_function=sentence_transformer_ef,
        metadata={"description": "Customer complaints and issues"}
    )
    print("✅ New collection created")

def get_db():
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def add_issue_to_vector_db(issue_id: str, issue_text: str, metadata: dict):
    """Vector DB'ye sorun ekle"""
    try:
        issues_collection.add(
            documents=[issue_text],
            metadatas=[metadata],
            ids=[issue_id]
        )
    except Exception as e:
        print(f"Vector DB Error: {e}")

def find_similar_issues(issue_text: str, n_results: int = 5):
    """Benzer sorunları bul"""
    try:
        results = issues_collection.query(
            query_texts=[issue_text],
            n_results=n_results
        )
        return results
    except Exception as e:
        print(f"Vector Search Error: {e}")
        return None

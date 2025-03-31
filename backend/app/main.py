from fastapi import FastAPI, HTTPException, BackgroundTasks, Request # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from pydantic import BaseModel # type: ignore
from selenium.common.exceptions import WebDriverException # type: ignore
from fastapi.staticfiles import StaticFiles # type: ignore
from fastapi.responses import FileResponse, HTMLResponse # type: ignore
import re
import chess # type: ignore
from typing import List, Dict, Optional, Tuple, Any
import os
import logging
import json
import traceback

# Importa la funzione di estrazione dal file mosse.py e l'evaluator
from app.mosse import extract_chess_moves
from app.chess_evaluator import ChessEvaluator

# Configurazione del logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Chess Game API")

# Configura CORS - DEVE ESSERE ALL'INIZIO
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Consenti tutte le origini in ambiente di sviluppo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Inizializza il valutatore (cerca un modello esistente o crea un nuovo modello)
model_path = "models/chess_evaluator.h5"
evaluator = None

def initialize_evaluator():
    """Inizializza il valutatore come variabile globale"""
    global evaluator
    evaluator = ChessEvaluator(model_path if os.path.exists(model_path) else None)

# Inizializza il valutatore all'avvio dell'applicazione
@app.on_event("startup")
async def startup_event():
    initialize_evaluator()
    logger.info("Valutatore di scacchi inizializzato")

class ChessUrlRequest(BaseModel):
    url: str

class EvaluationRequest(BaseModel):
    fen: str
    depth: Optional[int] = 3  # Profondità di analisi opzionale (default 3)

class MoveEvaluationResult(BaseModel):
    move: str  # Mossa in formato SAN
    uci: str   # Mossa in formato UCI
    evaluation: float  # Valutazione numerica
    is_best: bool = False  # Indica se è la mossa migliore
    is_worst: bool = False  # Indica se è la mossa peggiore

class PositionEvaluation(BaseModel):
    fen: str
    evaluation: float  # Valutazione numerica complessiva
    advantage: str  # "white", "black", o "equal"
    advantage_score: float  # Quanto è forte il vantaggio (0-1)
    best_moves: List[MoveEvaluationResult]  # Lista delle migliori mosse
    worst_move: MoveEvaluationResult  # La mossa peggiore

# ========= ENDPOINT API - DEFINITI PRIMA DEL FRONTEND =========

# Health check API - utile per verificare che il backend funzioni
@app.get("/api/health")
async def health_check():
    """Health check per verificare che il backend funzioni correttamente"""
    return {"status": "ok", "message": "Il backend è in esecuzione"}

@app.get("/api/chess/game/{game_id}")
async def get_game(game_id: str, analyze: bool = False, background_tasks: BackgroundTasks = None):
    """
    API endpoint per ottenere i dati di una partita di chess.com con informazioni dettagliate.
    
    Args:
        game_id: ID della partita su chess.com
        analyze: Se True, analizza la partita con la rete neurale (può richiedere più tempo)
    
    Returns:
        JSON con i dati dettagliati della partita, incluse le mosse, posizioni FEN e, 
        se richiesto, le analisi di ogni posizione
    """
    chess_url = f"https://www.chess.com/game/live/{game_id}"
    
    try:
        # Estrai le mosse utilizzando la funzione dal file mosse.py
        result = extract_chess_moves(chess_url)
        
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        
        if 'moves' not in result or not result['moves']:
            raise HTTPException(status_code=404, detail='Nessuna mossa trovata')
        
        # Estrai le informazioni dei giocatori se disponibili
        players = {
            'white': {
                'username': result.get('players', {}).get('white', 'Giocatore Bianco'),
                'rating': 0  # Non abbiamo il rating dalle informazioni estratte
            },
            'black': {
                'username': result.get('players', {}).get('black', 'Giocatore Nero'),
                'rating': 0  # Non abbiamo il rating dalle informazioni estratte
            }
        }
        
        # Crea il risultato finale
        game_data = {
            'id': game_id,
            'moves': result['moves'],  # Contiene informazioni dettagliate
            'positions': result.get('positions', []),  # Posizioni FEN
            'white': players['white'],
            'black': players['black'],
            'result': "Sconosciuto",  # Non estratto, potremmo aggiungerlo in futuro
            'timeControl': "Sconosciuto"  # Non estratto, potremmo aggiungerlo in futuro
        }
        
        # Se è richiesta l'analisi e l'evaluator è disponibile
        if analyze and evaluator:
            analysis = analyze_positions(game_data['positions'])
            game_data['analysis'] = analysis
            
            # Aggiungi informazioni di analisi a ciascuna mossa
            if len(analysis) >= len(game_data['moves']):
                for i, move in enumerate(game_data['moves']):
                    if i < len(analysis) - 1:  # -1 perché le posizioni includono la posizione iniziale
                        move_analysis = analysis[i + 1]  # +1 perché la prima posizione è quella iniziale
                        # Trova se questa mossa era la migliore possibile
                        prev_analysis = analysis[i]
                        
                        if prev_analysis.get("best_moves") and len(prev_analysis["best_moves"]) > 0:
                            best_uci = prev_analysis["best_moves"][0].get("uci", "")
                            if move.get("uci") == best_uci:
                                move["is_best_move"] = True
                            else:
                                move["is_best_move"] = False
                                
                            # Aggiungi anche la valutazione della mossa corrente
                            move["evaluation"] = move_analysis.get("evaluation", 0)
        
        return game_data
    
    except WebDriverException as e:
        raise HTTPException(status_code=500, detail=f'Errore Selenium: {str(e)}')
    except Exception as e:
        logger.exception("Errore nel recupero della partita")
        raise HTTPException(status_code=500, detail=f'Si è verificato un errore: {str(e)}')

@app.post("/api/chess/url")
async def extract_from_url(request: ChessUrlRequest, analyze: bool = False, background_tasks: BackgroundTasks = None):
    """
    API endpoint per estrarre i dati di una partita da un URL completo.
    
    Args:
        request.url: URL completo della partita su chess.com
        analyze: Se True, analizza la partita con la rete neurale
    
    Returns:
        JSON con i dati della partita, inclusi mosse e FEN per ogni posizione
    """
    chess_url = request.url
    
    # Verifica che l'URL provenga da chess.com per sicurezza
    if 'chess.com' not in chess_url:
        raise HTTPException(status_code=400, detail='L\'URL deve essere da chess.com')
    
    # Estrai l'ID della partita dall'URL
    match = re.search(r'chess\.com\/game\/live\/(\d+)', chess_url)
    
    if not match:
        raise HTTPException(status_code=400, detail='Formato URL non valido')
    
    game_id = match.group(1)
    
    # Redirigi alla funzione che gestisce l'ID della partita
    return await get_game(game_id, analyze, background_tasks)

@app.post("/api/chess/evaluate", response_model=PositionEvaluation)
async def evaluate_position(request: EvaluationRequest):
    """
    API endpoint per valutare una posizione di scacchi.
    
    Args:
        request.fen: Posizione in formato FEN
        request.depth: Profondità di analisi (default: 3)
    
    Returns:
        Analisi della posizione con valutazione, migliori mosse e peggiore mossa
    """
    if not evaluator:
        initialize_evaluator()
        
    fen = request.fen
    depth = request.depth
    
    try:
        # Valuta la posizione
        board = chess.Board(fen)
        
        # Ottieni la valutazione complessiva
        evaluation = evaluator.evaluate_position(board)
        
        # Ottieni chi ha il vantaggio
        advantage_player, advantage_score = evaluator.get_position_advantage(board)
        
        # Trova le migliori mosse
        best_moves_results = evaluator.find_best_move(board, top_n=depth)
        best_moves = []
        
        for move, eval_score in best_moves_results:
            move_san = board.san(move)
            move_result = {
                "move": move_san,
                "uci": move.uci(),
                "evaluation": eval_score,
                "is_best": False,
                "is_worst": False
            }
            best_moves.append(move_result)
        
        if best_moves:
            best_moves[0]["is_best"] = True
            
        # Trova la mossa peggiore
        worst_move, worst_eval = evaluator.find_worst_move(board)
        worst_move_san = board.san(worst_move)
        worst_move_result = {
            "move": worst_move_san,
            "uci": worst_move.uci(),
            "evaluation": worst_eval,
            "is_best": False,
            "is_worst": True
        }
        
        # Crea il risultato finale
        result = {
            "fen": fen,
            "evaluation": evaluation,
            "advantage": advantage_player,
            "advantage_score": advantage_score,
            "best_moves": best_moves,
            "worst_move": worst_move_result
        }
        
        return result
    
    except Exception as e:
        logger.exception("Errore nella valutazione della posizione")
        raise HTTPException(status_code=500, detail=f'Errore nella valutazione: {str(e)}')

def analyze_positions(positions: List[str]) -> List[Dict[str, Any]]:
    """
    Analizza una lista di posizioni FEN.
    
    Args:
        positions: Lista di posizioni FEN
    
    Returns:
        Lista di analisi per ogni posizione
    """
    if not evaluator:
        initialize_evaluator()
        
    analyses = []
    
    for fen in positions:
        try:
            # Crea un dizionario per memorizzare l'analisi
            analysis = {}
            
            # Valuta la posizione
            board = chess.Board(fen)
            
            # Ottieni la valutazione complessiva
            evaluation = evaluator.evaluate_position(board)
            analysis["evaluation"] = evaluation
            
            # Ottieni chi ha il vantaggio
            advantage_player, advantage_score = evaluator.get_position_advantage(board)
            analysis["advantage"] = advantage_player
            analysis["advantage_score"] = advantage_score
            
            # Trova le migliori mosse (top 3)
            best_moves_results = evaluator.find_best_move(board, top_n=3)
            best_moves = []
            
            for move, eval_score in best_moves_results:
                try:
                    move_san = board.san(move)
                except:
                    move_san = move.uci()
                    
                move_result = {
                    "move": move_san,
                    "uci": move.uci(),
                    "evaluation": eval_score,
                    "is_best": False
                }
                best_moves.append(move_result)
            
            if best_moves:
                best_moves[0]["is_best"] = True
                
            analysis["best_moves"] = best_moves
            
            # Trova la mossa peggiore
            try:
                worst_move, worst_eval = evaluator.find_worst_move(board)
                try:
                    worst_move_san = board.san(worst_move)
                except:
                    worst_move_san = worst_move.uci()
                
                worst_move_result = {
                    "move": worst_move_san,
                    "uci": worst_move.uci(),
                    "evaluation": worst_eval,
                    "is_worst": True
                }
                analysis["worst_move"] = worst_move_result
            except:
                # Potrebbe non essere possibile trovare la mossa peggiore
                analysis["worst_move"] = None
                
            analyses.append(analysis)
            
        except Exception as e:
            logger.exception(f"Errore nell'analisi della posizione: {fen}")
            analyses.append({"error": str(e)})
    
    return analyses

# ========= GESTIONE FRONTEND - ALLA FINE DEL FILE =========

# Percorso assoluto alla directory frontend/dist
frontend_dir = os.path.abspath("../frontend/dist")

# Verifica che le directory esistano e stampa info di debug
if not os.path.exists(frontend_dir):
    logger.error(f"⚠️ Directory frontend non trovata: {frontend_dir}")
    logger.info(f"Directory corrente: {os.path.abspath('.')}")
    logger.info(f"Directory genitore: {os.path.abspath('..')}")
else:
    logger.info(f"✅ Directory frontend trovata: {frontend_dir}")
    
    assets_dir = os.path.join(frontend_dir, "assets")
    if not os.path.exists(assets_dir):
        logger.error(f"⚠️ Directory assets non trovata: {assets_dir}")
    else:
        logger.info(f"✅ Directory assets trovata: {assets_dir}")
        # Monta la directory assets separatamente
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        logger.info("✅ Montaggio degli assets completato")

# Route fallback per servire index.html
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # Non gestire richieste API
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    # Percorsi specifici da non gestire come frontend
    if full_path == "docs" or full_path == "redoc" or full_path == "openapi.json":
        raise HTTPException(status_code=404, detail="Endpoint non trovato")
    
    # Servi index.html per il routing lato client
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        logger.error(f"File index.html non trovato: {index_path}")
        raise HTTPException(status_code=404, detail="Frontend non trovato")
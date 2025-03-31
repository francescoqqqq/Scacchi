import time
from selenium import webdriver # type: ignore
from selenium.webdriver.chrome.options import Options # type: ignore
from selenium.webdriver.common.by import By # type: ignore
from selenium.webdriver.support.ui import WebDriverWait # type: ignore
from selenium.webdriver.support import expected_conditions as EC # type: ignore
import re
import chess # type: ignore
import chess.pgn # type: ignore

def extract_chess_moves(chess_com_url):
    """
    Estrae le mosse di una partita di scacchi da un URL di chess.com
    utilizzando il metodo dei nodi di movimento, che funziona per questo caso.
    
    Args:
        chess_com_url (str): L'URL della partita su chess.com
        
    Returns:
        dict: Un dizionario contenente le mosse dettagliate, posizioni FEN e informazioni dei giocatori
    """
    # Configura Chrome in modalità headless
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    
    # Aggiunge uno user agent per sembrare un browser reale
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
    
    driver = None
    
    try:
        # Inizializza il driver
        driver = webdriver.Chrome(options=chrome_options)
        
        # Imposta un timeout per il caricamento della pagina
        driver.set_page_load_timeout(20)
        
        # Carica la pagina
        print(f"Caricamento della pagina: {chess_com_url}")
        driver.get(chess_com_url)
        
        # Attendi che la pagina sia completamente caricata
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Breve attesa per il caricamento delle mosse
        time.sleep(3)
        
        # Estrazione delle informazioni dei giocatori
        player_info = {}
        try:
            # Usando selettore più generico
            white_player_elem = driver.find_element(By.CSS_SELECTOR, "[data-player='white'] .user-tagline-username, .white.user-username")
            black_player_elem = driver.find_element(By.CSS_SELECTOR, "[data-player='black'] .user-tagline-username, .black.user-username")
            
            player_info["white"] = white_player_elem.text.strip()
            player_info["black"] = black_player_elem.text.strip()
        except:
            print("Non è stato possibile estrarre le informazioni dei giocatori")
        
        # Estrazione dai nodi di movimento (il metodo che ha funzionato)
        all_moves = []
        print("Estrazione mosse dai nodi di movimento...")
        
        move_elements = driver.find_elements(By.CSS_SELECTOR, ".move, .node")
        
        if move_elements:
            for element in move_elements:
                move_text = element.text.strip()
                
                # Verifica se il testo è una mossa valida degli scacchi
                if re.match(r'^([KQRBNP]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|O-O-O|O-O)[+#]?$', move_text):
                    all_moves.append(move_text)
            
            print(f"Estratte {len(all_moves)} mosse dai nodi di movimento")
        
        # Elabora le mosse utilizzando python-chess
        if all_moves:
            detailed_moves = process_moves_with_chess_library(all_moves)
            
            result = {
                "moves": detailed_moves["moves"],
                "positions": detailed_moves["positions"]
            }
            
            if player_info:
                result["players"] = player_info
                
            return result
        
        # Se non abbiamo trovato mosse
        return {"error": "Impossibile trovare le mosse nella pagina"}
    
    except Exception as e:
        print(f"Si è verificato un errore: {str(e)}")
        return {"error": f"Si è verificato un errore: {str(e)}"}
    
    finally:
        # Chiudi il browser
        if driver:
            driver.quit()

def process_moves_with_chess_library(moves_list):
    """
    Elabora una lista di mosse in notazione algebrica usando python-chess
    
    Args:
        moves_list (list): Lista di mosse in notazione algebrica
        
    Returns:
        dict: Dizionario con mosse dettagliate e posizioni FEN
    """
    # Inizializza la scacchiera
    board = chess.Board()
    
    detailed_moves = []
    positions = [board.fen()]  # Posizione iniziale
    
    for i, san_move in enumerate(moves_list):
        try:
            # Converte la notazione SAN in un oggetto Move
            move = board.parse_san(san_move)
            
            # Ottieni informazioni dettagliate sulla mossa
            from_square = chess.square_name(move.from_square)
            to_square = chess.square_name(move.to_square)
            piece_type = board.piece_type_at(move.from_square)
            piece_name = piece_type_to_name(piece_type)
            
            # Controlla se è una cattura
            is_capture = board.is_capture(move)
            
            # Controlla se è uno scacco
            board.push(move)
            is_check = board.is_check()
            is_checkmate = board.is_checkmate()
            
            # Crea un dizionario con dettagli completi sulla mossa
            move_details = {
                "san": san_move,
                "uci": move.uci(),
                "from": from_square,
                "to": to_square,
                "piece": piece_name,
                "color": "white" if i % 2 == 0 else "black",
                "capture": is_capture,
                "check": is_check,
                "checkmate": is_checkmate,
                "moveNumber": (i // 2) + 1
            }
            
            # Controlla se è una promozione
            if move.promotion:
                move_details["promotion"] = piece_type_to_name(move.promotion)
            
            # Controlla se è un arrocco
            if piece_type == chess.KING and abs(chess.square_file(move.from_square) - chess.square_file(move.to_square)) > 1:
                move_details["castling"] = "kingside" if chess.square_file(move.to_square) == 6 else "queenside"
            
            detailed_moves.append(move_details)
            
            # Aggiungi la nuova posizione FEN dopo la mossa
            positions.append(board.fen())
            
        except Exception as e:
            print(f"Errore nell'elaborazione della mossa {san_move}: {str(e)}")
            # Se non possiamo elaborare una mossa, aggiungiamo comunque i dati di base
            detailed_moves.append({
                "san": san_move,
                "color": "white" if i % 2 == 0 else "black",
                "moveNumber": (i // 2) + 1
            })
            positions.append(board.fen())  # Posizione invariata in caso di errore
    
    return {
        "moves": detailed_moves,
        "positions": positions
    }

def piece_type_to_name(piece_type):
    """
    Converte un tipo di pezzo di python-chess in una stringa rappresentativa
    """
    if piece_type == chess.PAWN:
        return "pawn"
    elif piece_type == chess.KNIGHT:
        return "knight"
    elif piece_type == chess.BISHOP:
        return "bishop"
    elif piece_type == chess.ROOK:
        return "rook"
    elif piece_type == chess.QUEEN:
        return "queen"
    elif piece_type == chess.KING:
        return "king"
    else:
        return "unknown"

# Esempio di utilizzo
if __name__ == "__main__":
    chess_url = input("Inserisci l'URL della partita di scacchi su chess.com: ")
    
    print("\nEstrazione delle mosse in corso...")
    game_info = extract_chess_moves(chess_url)
    
    if "error" in game_info:
        print(f"\nErrore: {game_info['error']}")
    elif "moves" in game_info and game_info["moves"]:
        print("\nSequenza di mosse:")
        for move in game_info["moves"]:
            print(f"Mossa {move['moveNumber']} ({move['color']}): {move['san']} - da {move['from']} a {move['to']} ({move['piece']})")
        
        # Mostra anche quante mosse sono state trovate
        print(f"\nTotale mosse trovate: {len(game_info['moves'])}")
        
        # Mostra le informazioni dei giocatori se disponibili
        if "players" in game_info:
            print("\nGiocatori:")
            print(f"Bianco: {game_info['players'].get('white', 'Sconosciuto')}")
            print(f"Nero: {game_info['players'].get('black', 'Sconosciuto')}")
    else:
        print("\nNessuna mossa trovata.")
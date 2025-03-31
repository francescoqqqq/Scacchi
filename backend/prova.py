import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import re

def extract_chess_moves(chess_com_url):
    """
    Estrae le mosse di una partita di scacchi da un URL di chess.com
    basandosi sulla struttura specifica del DOM di chess.com
    
    Args:
        chess_com_url (str): L'URL della partita su chess.com
        
    Returns:
        dict: Un dizionario contenente le mosse e, se disponibili, le informazioni dei giocatori
    """
    # Configura Chrome in modalità headless
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    
    driver = None
    
    try:
        # Inizializza il driver
        driver = webdriver.Chrome(options=chrome_options)
        
        # Carica la pagina
        print(f"Caricamento della pagina: {chess_com_url}")
        driver.get(chess_com_url)
        
        # Attendi che la pagina sia completamente caricata
        time.sleep(5)  # Attesa sufficiente per caricare il JavaScript
        
        # Metodo 1: Cerca le mosse nei nodi specifici basati sullo screenshot
        print("Cercando mosse nei nodi della partita...")
        
        # Cerca tutti gli elementi con classe "node white-move main-line-ply" o "node black-move main-line-ply"
        white_moves = driver.find_elements(By.CSS_SELECTOR, ".node.white-move, [class*='node white-move']")
        black_moves = driver.find_elements(By.CSS_SELECTOR, ".node.black-move, [class*='node black-move']")
        
        if not white_moves and not black_moves:
            print("Tentativo con selettori alternativi...")
            # Prova selettori alternativi basati sugli attributi data-node
            all_nodes = driver.find_elements(By.CSS_SELECTOR, "[data-node]")
            
            if all_nodes:
                print(f"Trovati {len(all_nodes)} nodi con attributo data-node")
                # Ottieni il testo di ciascun nodo
                nodes_with_text = []
                for node in all_nodes:
                    node_text = node.text.strip()
                    if node_text and not node_text.isdigit():
                        nodes_with_text.append(node_text)
                
                if nodes_with_text:
                    print(f"Estratte {len(nodes_with_text)} mosse dai nodi")
                    return {"moves": nodes_with_text}
        
        # Metodo 2: Cerca direttamente nelle righe della lista mosse
        if not white_moves and not black_moves:
            print("Cercando mosse nelle righe della lista mosse...")
            move_rows = driver.find_elements(By.CSS_SELECTOR, ".main-line-row.move-list-row, [class*='main-line-row move-list-row']")
            
            if move_rows:
                print(f"Trovate {len(move_rows)} righe di mosse")
                all_moves = []
                
                for row in move_rows:
                    move_text = row.text.strip()
                    # Rimuovi i numeri delle mosse (es. "1.", "2.", ecc.)
                    clean_move = re.sub(r'^\d+\.+\s*', '', move_text)
                    # Dividi in caso ci siano sia la mossa bianca che la mossa nera
                    moves_in_row = clean_move.split()
                    for move in moves_in_row:
                        if move and not move.isdigit():
                            all_moves.append(move)
                
                if all_moves:
                    print(f"Estratte {len(all_moves)} mosse dalle righe")
                    return {"moves": all_moves}
        
        # Metodo 3: Cerca direttamente tutti gli span con classe node-highlight-content
        print("Cercando mosse negli span...")
        move_spans = driver.find_elements(By.CSS_SELECTOR, "span.node-highlight-content, [class*='node-highlight-content']")
        
        if move_spans:
            print(f"Trovati {len(move_spans)} span con mosse")
            all_moves = []
            
            for span in move_spans:
                move_text = span.text.strip()
                if move_text and not move_text.isdigit():
                    all_moves.append(move_text)
            
            if all_moves:
                print(f"Estratte {len(all_moves)} mosse dagli span")
                return {"moves": all_moves}
        
        # Metodo 4: Estrai direttamente dalla tabella delle mosse visibile
        print("Cercando mosse nella tabella visibile...")
        
        # Trova tutti gli elementi di testo nei contenitori delle mosse
        move_elements = driver.find_elements(By.CSS_SELECTOR, "#LiveChessTopMove span, #live-game-tab-scroll-container span, [id*='game'] [class*='move']")
        
        all_moves = []
        for element in move_elements:
            move_text = element.text.strip()
            
            # Verifica se il testo è una mossa valida degli scacchi (pattern di base)
            # Esempi: e4, Nf3, O-O, exd5, Qxf7+, e8=Q, etc.
            if re.match(r'^([KQRBNP]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|O-O-O|O-O)[+#]?$', move_text):
                all_moves.append(move_text)
        
        if all_moves:
            print(f"Estratte {len(all_moves)} mosse dagli elementi di testo")
            return {"moves": all_moves}
        
        # Metodo 5: Tentativo finale - cerca nel documento HTML grezzo
        print("Cercando mosse nel codice HTML grezzo...")
        html_content = driver.page_source
        
        # Pattern per identificare le mosse degli scacchi
        chess_moves_pattern = r'\b([KQRBNP]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|O-O-O|O-O)[+#]?\b'
        raw_moves = re.findall(chess_moves_pattern, html_content)
        
        # Estrai il primo gruppo della regex per ogni match e rimuovi duplicati
        if raw_moves:
            unique_moves = []
            seen = set()
            for match in raw_moves:
                move = match[0]  # Il primo gruppo della regex contiene la mossa
                if move not in seen and len(move) <= 7:  # Limite ragionevole per evitare falsi positivi
                    seen.add(move)
                    unique_moves.append(move)
            
            print(f"Estratte {len(unique_moves)} mosse dal HTML grezzo")
            return {"moves": unique_moves}
        
        print("Non sono state trovate mosse con nessun metodo.")
        return {"error": "Impossibile trovare le mosse nella pagina"}
    
    except Exception as e:
        print(f"Si è verificato un errore: {str(e)}")
        return {"error": f"Si è verificato un errore: {str(e)}"}
    
    finally:
        # Chiudi il browser
        if driver:
            driver.quit()

def format_moves(moves):
    """
    Formatta le mosse in una visualizzazione ordinata per numero
    
    Args:
        moves (list): Lista di mosse
        
    Returns:
        str: Stringa formattata con le mosse numerate
    """
    formatted_output = ""
    for i, move in enumerate(moves, 1):
        if i % 2 == 1:  # Mosse bianche
            formatted_output += f"{(i+1)//2}. {move} "
        else:  # Mosse nere
            formatted_output += f"{move}\n"
    
    # Assicurati di andare a capo alla fine se necessario
    if len(moves) % 2 == 1:
        formatted_output += "\n"
    
    return formatted_output

# Esempio di utilizzo
if __name__ == "__main__":
    chess_url = input("Inserisci l'URL della partita di scacchi su chess.com: ")
    
    print("\nEstrazione delle mosse in corso...")
    game_info = extract_chess_moves(chess_url)
    
    if "error" in game_info:
        print(f"\nErrore: {game_info['error']}")
    elif "moves" in game_info and game_info["moves"]:
        print("\nSequenza di mosse:")
        for i, move in enumerate(game_info["moves"], 1):
            if i % 2 == 1:  # Mosse bianche
                print(f"{(i+1)//2}. {move}", end=" ")
            else:  # Mosse nere
                print(f"{move}")
        
        # Assicurati di andare a capo alla fine
        if len(game_info["moves"]) % 2 == 1:
            print()  # Nuova riga finale
        
        # Mostra anche quante mosse sono state trovate
        print(f"\nTotale mosse trovate: {len(game_info['moves'])}")
    else:
        print("\nNessuna mossa trovata.")
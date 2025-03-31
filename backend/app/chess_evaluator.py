import chess # type: ignore
import chess.pgn # type: ignore
import numpy as np
import torch # type: ignore
import torch.nn as nn # type: ignore
import torch.optim as optim # type: ignore
import os
from pathlib import Path
import logging

# Configurazione del logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ChessModel(nn.Module):
    """
    Modello di rete neurale convoluzionale per la valutazione degli scacchi.
    """
    def __init__(self):
        super(ChessModel, self).__init__()
        
        # Blocco convoluzionale 1
        self.conv1 = nn.Sequential(
            nn.Conv2d(12, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(64),
            nn.Conv2d(64, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(64)
        )
        
        # Blocco convoluzionale 2
        self.conv2 = nn.Sequential(
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(128),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(128)
        )
        
        # Blocco convoluzionale 3
        self.conv3 = nn.Sequential(
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(256),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(256)
        )
        
        # Fully connected layers
        self.fc = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256 * 8 * 8, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 1),
            nn.Tanh()  # Output tra -1 e 1
        )
        
    def forward(self, x):
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.conv3(x)
        x = self.fc(x)
        return x


class ChessEvaluator:
    """
    Classe per valutare le posizioni scacchistiche utilizzando una rete neurale PyTorch.
    """
    def __init__(self, model_path=None, device=None):
        """
        Inizializza il valutatore di posizioni scacchistiche.
        
        Args:
            model_path: Percorso del modello pre-addestrato. Se None, viene creato un nuovo modello.
            device: Device su cui eseguire il modello (cpu o cuda). Se None, viene selezionato automaticamente.
        """
        self.input_shape = (12, 8, 8)  # Canali, altezza, larghezza (formato PyTorch)
        
        # Seleziona il device
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)
        
        logger.info(f"Utilizzo del device: {self.device}")
        
        # Crea o carica il modello
        if model_path and os.path.exists(model_path):
            logger.info(f"Caricamento del modello da {model_path}")
            self.model = torch.load(model_path, map_location=self.device)
        else:
            logger.info("Creazione di un nuovo modello")
            self.model = ChessModel().to(self.device)
            
        # Imposta il criterio di loss e l'ottimizzatore
        self.criterion = nn.MSELoss()
        self.optimizer = optim.Adam(self.model.parameters(), lr=0.001)

    def _board_to_input(self, board):
        """
        Converte una scacchiera in un input per la rete neurale.
        
        Args:
            board: Un oggetto chess.Board
            
        Returns:
            Un tensor PyTorch di forma (1, 12, 8, 8)
        """
        piece_types = [chess.PAWN, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING]
        input_data = np.zeros(self.input_shape, dtype=np.float32)
        
        # Per ogni casella della scacchiera
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece:
                # Calcola gli indici nella matrice di input
                row, col = 7 - chess.square_rank(square), chess.square_file(square)
                piece_idx = piece_types.index(piece.piece_type)
                # Se è un pezzo nero, aggiungi 6 all'indice
                if not piece.color:
                    piece_idx += 6
                # Imposta a 1 il canale corrispondente
                input_data[piece_idx, row, col] = 1.0
                
        # Converti in tensor PyTorch e aggiungi la dimensione del batch
        input_tensor = torch.tensor(input_data, dtype=torch.float32).unsqueeze(0).to(self.device)
        return input_tensor

    def evaluate_position(self, board):
        """
        Valuta una posizione scacchistica e restituisce un punteggio.
        
        Args:
            board: Un oggetto chess.Board o una stringa FEN
            
        Returns:
            Un valore float tra -1 e 1, dove:
            - Valori positivi indicano vantaggio per il bianco
            - Valori negativi indicano vantaggio per il nero
            - 0 indica una posizione equilibrata
        """
        if isinstance(board, str):
            # Se è una stringa FEN, converte in un oggetto board
            board = chess.Board(board)
            
        # Converti la scacchiera in un input per la rete
        input_tensor = self._board_to_input(board)
        
        # Valutazione
        self.model.eval()
        with torch.no_grad():
            evaluation = self.model(input_tensor)
            
        return float(evaluation.item())

    def evaluate_move(self, board, move):
        """
        Valuta una mossa specifica e restituisce un punteggio.
        
        Args:
            board: Un oggetto chess.Board o una stringa FEN
            move: Una mossa in formato UCI o un oggetto chess.Move
            
        Returns:
            Un valore float che rappresenta la valutazione dopo la mossa
        """
        if isinstance(board, str):
            board = chess.Board(board)
            
        if isinstance(move, str):
            move = chess.Move.from_uci(move)
            
        # Crea una copia della scacchiera
        board_copy = board.copy()
        
        # Esegui la mossa
        board_copy.push(move)
        
        # Valuta la nuova posizione
        evaluation = self.evaluate_position(board_copy)
        
        # Se è il turno del nero, negare il valore (dal punto di vista del giocatore corrente)
        if not board.turn:
            evaluation = -evaluation
            
        return float(evaluation)

    def find_best_move(self, board, top_n=1):
        """
        Trova la migliore mossa o le migliori n mosse per una data posizione.
        
        Args:
            board: Un oggetto chess.Board o una stringa FEN
            top_n: Numero di mosse migliori da restituire
            
        Returns:
            Una lista di tuple (mossa, valutazione) ordinate dalla migliore alla peggiore
        """
        if isinstance(board, str):
            board = chess.Board(board)
            
        # Genera tutte le mosse legali
        legal_moves = list(board.legal_moves)
        
        # Valuta ogni mossa
        move_evaluations = []
        for move in legal_moves:
            evaluation = self.evaluate_move(board, move)
            move_evaluations.append((move, evaluation))
            
        # Ordina le mosse in base alla valutazione (dalla migliore alla peggiore)
        move_evaluations.sort(key=lambda x: -x[1] if board.turn else x[1])
        
        return move_evaluations[:top_n]

    def find_worst_move(self, board):
        """
        Trova la mossa peggiore per una data posizione.
        
        Args:
            board: Un oggetto chess.Board o una stringa FEN
            
        Returns:
            Una tupla (mossa, valutazione) della mossa peggiore
        """
        if isinstance(board, str):
            board = chess.Board(board)
            
        # Genera tutte le mosse legali
        legal_moves = list(board.legal_moves)
        
        # Valuta ogni mossa
        move_evaluations = []
        for move in legal_moves:
            evaluation = self.evaluate_move(board, move)
            move_evaluations.append((move, evaluation))
            
        # Ordina le mosse in base alla valutazione (dalla peggiore alla migliore)
        move_evaluations.sort(key=lambda x: x[1] if board.turn else -x[1])
        
        return move_evaluations[0]

    def get_position_advantage(self, board):
        """
        Determina chi ha il vantaggio nella posizione corrente e quantifica il vantaggio.
        
        Args:
            board: Un oggetto chess.Board o una stringa FEN
            
        Returns:
            Una tupla (giocatore_in_vantaggio, vantaggio) dove:
            - giocatore_in_vantaggio è 'white', 'black', o 'equal'
            - vantaggio è un valore float tra 0 e 1
        """
        if isinstance(board, str):
            board = chess.Board(board)
            
        evaluation = self.evaluate_position(board)
        
        # Determina il giocatore in vantaggio
        if abs(evaluation) < 0.1:
            return ('equal', 0.0)
        elif evaluation > 0:
            return ('white', evaluation)
        else:
            return ('black', abs(evaluation))

    def save_model(self, model_path):
        """
        Salva il modello su disco.
        
        Args:
            model_path: Percorso dove salvare il modello
        """
        # Assicurati che la directory esista
        Path(model_path).parent.mkdir(parents=True, exist_ok=True)
        torch.save(self.model, model_path)
        logger.info(f"Modello salvato in {model_path}")

    def train_on_example(self, board, target_evaluation, batch_size=32):
        """
        Addestra il modello su un singolo esempio.
        
        Args:
            board: Un oggetto chess.Board o una stringa FEN
            target_evaluation: Il valore target (-1 a 1)
            batch_size: Dimensione del batch per l'addestramento (non usato in questo contesto)
            
        Returns:
            La loss dopo l'addestramento
        """
        if isinstance(board, str):
            board = chess.Board(board)
            
        # Converti la scacchiera in un input per la rete
        input_tensor = self._board_to_input(board)
        
        # Converti il target in un tensor PyTorch
        target = torch.tensor([[target_evaluation]], dtype=torch.float32).to(self.device)
        
        # Imposta il modello in modalità training
        self.model.train()
        
        # Zero gradients
        self.optimizer.zero_grad()
        
        # Forward pass
        output = self.model(input_tensor)
        
        # Calcola la loss
        loss = self.criterion(output, target)
        
        # Backward pass e ottimizzazione
        loss.backward()
        self.optimizer.step()
        
        return loss.item()


# Uso di esempio della classe
def test_evaluator():
    # Crea un valutatore
    evaluator = ChessEvaluator()
    
    # Scacchiera iniziale
    board = chess.Board()
    
    # Valuta la posizione
    print(f"Valutazione posizione iniziale: {evaluator.evaluate_position(board)}")
    
    # Trova la mossa migliore
    best_move, eval_score = evaluator.find_best_move(board)[0]
    print(f"Migliore mossa: {best_move}, valutazione: {eval_score}")
    
    # Trova la mossa peggiore
    worst_move, eval_score = evaluator.find_worst_move(board)
    print(f"Peggior mossa: {worst_move}, valutazione: {eval_score}")
    
    # Chi ha il vantaggio?
    player, advantage = evaluator.get_position_advantage(board)
    print(f"Vantaggio: {player}, quantità: {advantage}")
    
    # Esempio di salvataggio del modello
    # evaluator.save_model("models/chess_evaluator.pt")


if __name__ == "__main__":
    test_evaluator()
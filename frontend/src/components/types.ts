// types.ts - Definizioni dei tipi usati in tutto il progetto

// Tipi di pezzi degli scacchi
export type ChessPiece = 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | '';
export type PieceColor = 'white' | 'black';

// Dettaglio di una mossa
export interface MoveDetail {
  san: string;         // Notazione algebrica standard
  uci: string;         // Notazione UCI
  from: string;        // Casella di partenza (es. "e2")
  to: string;          // Casella di arrivo (es. "e4")
  piece: string;       // Tipo di pezzo (es. "pawn", "knight", ecc.)
  color: string;       // Colore ("white" o "black")
  capture: boolean;    // Se è una cattura
  check: boolean;      // Se dà scacco
  checkmate: boolean;  // Se dà scacco matto
  moveNumber: number;  // Numero della mossa
  castling?: string;   // Se presente, tipo di arrocco ("kingside" o "queenside")
  promotion?: string;  // Se presente, tipo di pezzo promosso
  is_best_move?: boolean; // Se è la mossa migliore
  evaluation?: number;  // Valutazione della mossa
}

// Posizione sulla scacchiera
export interface Position {
  row: number;
  col: number;
}

// Mossa con origine e destinazione per l'highlight
export interface MoveHighlight {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  piece: ChessPiece;
  isCapture: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  promotion?: ChessPiece;
  castling?: string;
  isSuggested?: boolean;  // Se è una mossa suggerita dall'analisi
  evaluation?: number;   // Valore di valutazione della mossa
  isBestMove?: boolean;  // Se è la migliore mossa
  isWorstMove?: boolean; // Se è la peggiore mossa
  isFromBestMove?: boolean; // Se è la casella di partenza della mossa migliore
  isRookCastling?: boolean; // Se è una mossa di arrocco della torre
}

// Tipo per il gioco di scacchi
export interface ChessGame {
  id: string;
  moves: MoveDetail[];
  positions: string[]; // Posizioni FEN
  white: {
    username: string;
    rating: number;
  };
  black: {
    username: string;
    rating: number;
  };
  result: string;
  timeControl: string;
  analysis?: any[]; // Analisi delle posizioni
}

// Interfaccia per l'analisi di una posizione
export interface PositionAnalysisData {
  evaluation: number;     // Valutazione della posizione
  bestMoves: {
    uci: string;          // Mossa in formato UCI
    san: string;          // Mossa in formato SAN
    evaluation: number;   // Valutazione dopo la mossa
  }[];
  worstMoves?: {          // Mosse peggiori (opzionale)
    uci: string;
    san: string;
    evaluation: number;
  }[];
}
// utils.ts - Funzioni di utilità per la scacchiera e le mosse

import { ChessPiece, Position, MoveHighlight } from './types';

export const ChessUtils = {
  // Converti notazione algebrica a indici della matrice (es. "e4" -> {row: 4, col: 4})
  algebraicToIndices: (algebraic: string): Position => {
    const file = algebraic.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(algebraic.charAt(1));
    return { row: rank, col: file };
  },
  
  // Mappa i nomi dei pezzi alle loro rappresentazioni
  pieceNameToChar: (pieceName: string, isWhite: boolean): ChessPiece => {
    const map: Record<string, ChessPiece> = {
      'pawn': isWhite ? 'P' : 'p',
      'knight': isWhite ? 'N' : 'n',
      'bishop': isWhite ? 'B' : 'b',
      'rook': isWhite ? 'R' : 'r',
      'queen': isWhite ? 'Q' : 'q',
      'king': isWhite ? 'K' : 'k'
    };
    return map[pieceName] || '';
  },

  // Converti la notazione FEN in una matrice di pezzi
  fenToBoard: (fen: string): ChessPiece[][] => {
    const board: ChessPiece[][] = Array(8).fill(null).map(() => Array(8).fill(''));
    const [piecePlacement] = fen.split(' ');
    const rows = piecePlacement.split('/');

    for (let i = 0; i < 8; i++) {
      let col = 0;
      for (let j = 0; j < rows[i].length; j++) {
        const char = rows[i][j];
        if (/\d/.test(char)) {
          // Se è un numero, rappresenta spazi vuoti
          col += parseInt(char);
        } else {
          // Altrimenti è un pezzo
          board[i][col] = char as ChessPiece;
          col++;
        }
      }
    }

    return board;
  },

  // Funzione per renderizzare un pezzo in Unicode
  renderPieceSymbol: (piece: ChessPiece): string => {
    const pieceMap: Record<string, string> = {
      'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
      'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔',
      '': ''
    };
    return pieceMap[piece] || '';
  },

  // Funzione per renderizzare un pezzo per la lista dei pezzi catturati
  renderCapturedPiece: (piece: string, isWhite: boolean): string => {
    const pieceMap: Record<string, string> = {
      'pawn': isWhite ? '♙' : '♟',
      'knight': isWhite ? '♘' : '♞',
      'bishop': isWhite ? '♗' : '♝',
      'rook': isWhite ? '♖' : '♜',
      'queen': isWhite ? '♕' : '♛',
      'king': isWhite ? '♔' : '♚'
    };
    return pieceMap[piece] || '';
  },

  // Genera un highlight per una mossa data
  createMoveHighlight: (from: string, to: string, piece: string, color: string, options: {
    isCapture?: boolean,
    isCheck?: boolean,
    isCheckmate?: boolean,
    promotion?: string,
    castling?: string,
    isSuggested?: boolean,
    evaluation?: number,
    isBestMove?: boolean,
    isWorstMove?: boolean,
    isFromBestMove?: boolean
  } = {}): MoveHighlight => {
    const fromPos = ChessUtils.algebraicToIndices(from);
    const toPos = ChessUtils.algebraicToIndices(to);
    
    return {
      fromRow: fromPos.row,
      fromCol: fromPos.col,
      toRow: toPos.row,
      toCol: toPos.col,
      piece: ChessUtils.pieceNameToChar(piece, color === 'white'),
      isCapture: options.isCapture || false,
      isCheck: options.isCheck || false,
      isCheckmate: options.isCheckmate || false,
      promotion: options.promotion ? ChessUtils.pieceNameToChar(options.promotion, color === 'white') : undefined,
      castling: options.castling,
      isSuggested: options.isSuggested,
      evaluation: options.evaluation,
      isBestMove: options.isBestMove,
      isWorstMove: options.isWorstMove,
      isFromBestMove: options.isFromBestMove
    };
  },

  // Calcola i valori relativi dei pezzi catturati
  getPieceValue: (piece: string): number => {
    const pieceValues: Record<string, number> = {
      'pawn': 1,
      'knight': 3,
      'bishop': 3,
      'rook': 5,
      'queen': 9,
      'king': 0  // Il re non ha valore per il calcolo del vantaggio materiale
    };
    
    return pieceValues[piece] || 0;
  },

  // Ordina i pezzi per valore
  sortPiecesByValue: (pieces: string[]): string[] => {
    const order: Record<string, number> = {
      'queen': 1,
      'rook': 2,
      'bishop': 3,
      'knight': 4,
      'pawn': 5,
      'king': 6
    };
    
    return [...pieces].sort((a, b) => (order[a] || 99) - (order[b] || 99));
  }
};
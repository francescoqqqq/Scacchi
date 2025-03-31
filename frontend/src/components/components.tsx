// components.tsx - Componenti UI per il visualizzatore di scacchi
import React from 'react';
import { MoveDetail, MoveHighlight, PositionAnalysisData } from './types';
import { ChessUtils } from './utils';

// Interfaccia per evidenziare le mosse dell'arrocco (non definita in types.ts)
interface ExtendedMoveHighlight extends MoveHighlight {
  isRookCastling?: boolean;
  isFromBestMove?: boolean;
}

// Componente per visualizzare la scacchiera
export const Chessboard: React.FC<{ 
  fen: string;
  highlight: MoveHighlight | null;
  suggestedMoves?: {
    best?: MoveHighlight[];
    worst?: MoveHighlight[];
  };
  onShowBestMove?: () => void;
  showingBestMove?: boolean;
  currentEvaluation?: number;
}> = ({ 
  fen, 
  highlight, 
  suggestedMoves = {}, 
  onShowBestMove,
  showingBestMove = false,
  currentEvaluation 
}) => {
  const board = ChessUtils.fenToBoard(fen);

  // Combinare tutte le mosse evidenziate per un facile riferimento
  const allHighlights: Record<string, ExtendedMoveHighlight> = {};
  
  // Aggiungi l'highlight principale se esiste
  if (highlight) {
    // Casella di partenza
    const fromKey = `${highlight.fromRow}-${highlight.fromCol}`;
    allHighlights[fromKey] = highlight;
    
    // Casella di arrivo
    const toKey = `${highlight.toRow}-${highlight.toCol}`;
    allHighlights[toKey] = highlight;
    
    // Per l'arrocco, aggiungi anche le caselle della torre
    if (highlight.castling) {
      const isKingside = highlight.castling === 'kingside';
      const rookRow = highlight.fromRow;
      
      // Casella di origine della torre
      const rookFromCol = isKingside ? 7 : 0;
      allHighlights[`${rookRow}-${rookFromCol}`] = { 
        ...highlight, 
        isRookCastling: true 
      };
      
      // Casella di destinazione della torre
      const rookToCol = isKingside ? 5 : 3;
      allHighlights[`${rookRow}-${rookToCol}`] = { 
        ...highlight, 
        isRookCastling: true 
      };
    }
  }
  
  // Aggiungi le mosse migliori suggerite
  if (suggestedMoves.best && suggestedMoves.best.length > 0) {
    suggestedMoves.best.forEach(move => {
      // Per le mosse suggerite, aggiungiamo sia la casella di partenza che quella di destinazione
      const fromKey = `${move.fromRow}-${move.fromCol}`;
      const toKey = `${move.toRow}-${move.toCol}`;
      
      if (!allHighlights[fromKey]) {
        allHighlights[fromKey] = { ...move, isFromBestMove: true };
      }
      
      if (!allHighlights[toKey]) {
        allHighlights[toKey] = move;
      }
    });
  }
  
  // Aggiungi le mosse peggiori suggerite
  if (suggestedMoves.worst && suggestedMoves.worst.length > 0) {
    suggestedMoves.worst.forEach(move => {
      // Per le mosse suggerite, aggiungiamo solo le caselle di destinazione
      const toKey = `${move.toRow}-${move.toCol}`;
      if (!allHighlights[toKey]) { // Non sovrascrivere altri highlight
        allHighlights[toKey] = move;
      }
    });
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex items-start">
        {/* Barra di valutazione (se disponibile) */}
        {currentEvaluation !== undefined && (
          <EvaluationBar evaluation={currentEvaluation} />
        )}
        
        <div className="flex-grow">
          <div className="grid grid-cols-8 border border-gray-400">
            {board.map((row, rowIndex) => (
              row.map((piece, colIndex) => {
                const isBlack = (rowIndex + colIndex) % 2 === 1;
                const squareKey = `${rowIndex}-${colIndex}`;
                const highlightInfo = allHighlights[squareKey];
                
                // Calcola il colore di sfondo della casella
                let bgColor = isBlack ? 'bg-gray-600' : 'bg-gray-200';
                let borderColor = '';
                
                if (highlightInfo) {
                  // Highlight principale
                  if (squareKey === `${highlight?.fromRow}-${highlight?.fromCol}`) {
                    bgColor = 'bg-yellow-300';
                  } 
                  else if (squareKey === `${highlight?.toRow}-${highlight?.toCol}`) {
                    bgColor = highlight?.isCapture ? 'bg-red-400' : 'bg-green-400';
                  }
                  // Torre durante l'arrocco
                  else if (highlightInfo.isRookCastling) {
                    bgColor = 'bg-blue-300';
                  }
                  // Mossa migliore suggerita - casella di partenza
                  else if (highlightInfo.isFromBestMove) {
                    bgColor = isBlack ? 'bg-emerald-700' : 'bg-emerald-400';
                    borderColor = 'border-2 border-emerald-500';
                  }
                  // Mossa migliore suggerita - casella di destinazione
                  else if (highlightInfo.isBestMove) {
                    bgColor = 'bg-emerald-300';
                    borderColor = 'border-2 border-emerald-600';
                  }
                  // Mossa peggiore suggerita
                  else if (highlightInfo.isWorstMove) {
                    bgColor = 'bg-red-300';
                    borderColor = 'border-2 border-red-600';
                  }
                  // Altre mosse suggerite
                  else if (highlightInfo.isSuggested) {
                    bgColor = 'bg-blue-200';
                    borderColor = 'border border-blue-400';
                  }
                }
                
                // Evidenziazione speciale per il re sotto scacco
                const isKingUnderCheck = 
                  highlight?.isCheck && 
                  piece.toLowerCase() === 'k' && 
                  !highlightInfo;
                  
                if (isKingUnderCheck) {
                  borderColor = 'border-2 border-red-500';
                }
                
                return (
                  <div 
                    key={squareKey}
                    className={`w-12 h-12 flex items-center justify-center text-3xl ${bgColor} ${borderColor} relative`}
                  >
                    {ChessUtils.renderPieceSymbol(piece)}
                    
                    {/* Indicatore di valutazione per mosse suggerite */}
                    {highlightInfo && highlightInfo.evaluation !== undefined && 
                    (highlightInfo.isBestMove || highlightInfo.isWorstMove) && (
                      <div className={`absolute top-0 right-0 text-xs px-1 rounded-bl-md font-bold
                                      ${highlightInfo.isBestMove ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                        {highlightInfo.evaluation > 0 ? '+' : ''}{highlightInfo.evaluation.toFixed(1)}
                      </div>
                    )}

                    {/* Indicatori di partenza e arrivo per mosse suggerite */}
                    {highlightInfo && highlightInfo.isFromBestMove && (
                      <div className="absolute top-0 left-0 w-3 h-3 rounded-full bg-emerald-500"></div>
                    )}
                  </div>
                );
              })
            ))}
          </div>
          
          {/* File (a-h) */}
          <div className="grid grid-cols-8 text-center">
            {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(file => (
              <div key={file} className="text-sm font-medium">{file}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Pulsante per mostrare la mossa migliore */}
      {onShowBestMove && (
        <button 
          onClick={onShowBestMove}
          className={`mt-3 w-full py-2 px-4 rounded-md text-white font-medium 
                    ${showingBestMove ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {showingBestMove ? 'Nascondi mossa migliore' : 'Mostra mossa migliore'}
        </button>
      )}
      
      {/* Legenda per le evidenziazioni */}
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-300 mr-1"></div>
          <span>Casella di partenza</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-400 mr-1"></div>
          <span>Casella di arrivo</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-400 mr-1"></div>
          <span>Cattura</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-300 mr-1"></div>
          <span>Arrocco</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-emerald-300 mr-1 border border-emerald-600"></div>
          <span>Mossa migliore</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-300 mr-1 border border-red-600"></div>
          <span>Mossa peggiore</span>
        </div>
      </div>
    </div>
  );
};

// Componente per visualizzare i pezzi catturati
export const CapturedPieces: React.FC<{ 
  moves: MoveDetail[]; 
  currentMoveIndex: number;
}> = ({ moves, currentMoveIndex }) => {
  // Calcola i pezzi catturati fino alla mossa corrente
  const calculateCapturedPieces = () => {
    const whiteCaptured: string[] = [];
    const blackCaptured: string[] = [];
    
    // Usa solo le mosse fino all'indice corrente
    const relevantMoves = moves.slice(0, currentMoveIndex);
    
    // Itera tutte le mosse e trova le catture
    for (const move of relevantMoves) {
      if (move.capture) {
        // Il bianco ha catturato un pezzo nero
        if (move.color === 'white') {
          blackCaptured.push(move.piece);
        }
        // Il nero ha catturato un pezzo bianco
        else {
          whiteCaptured.push(move.piece);
        }
      }
    }
    
    return { whiteCaptured, blackCaptured };
  };
  
  const { whiteCaptured, blackCaptured } = calculateCapturedPieces();
  
  // Calcola il vantaggio materiale
  const calculateMaterialAdvantage = () => {
    const whiteValue = whiteCaptured.reduce((sum, piece) => sum + ChessUtils.getPieceValue(piece), 0);
    const blackValue = blackCaptured.reduce((sum, piece) => sum + ChessUtils.getPieceValue(piece), 0);
    
    return blackValue - whiteValue;  // Vantaggio del bianco (positivo se il bianco ha vantaggio)
  };
  
  const materialAdvantage = calculateMaterialAdvantage();
  
  return (
    <div className="mt-4 flex justify-between bg-gray-100 p-3 rounded-md">
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold mb-1">Pezzi Bianchi Catturati:</h3>
        <div className="flex flex-wrap gap-1">
          {ChessUtils.sortPiecesByValue(whiteCaptured).map((piece, index) => (
            <span key={index} className="text-2xl">{ChessUtils.renderCapturedPiece(piece, true)}</span>
          ))}
          {whiteCaptured.length === 0 && <span className="text-sm text-gray-500">Nessuno</span>}
        </div>
      </div>
      
      <div className="flex items-center mx-4">
        {materialAdvantage !== 0 && (
          <div className={`font-bold ${materialAdvantage > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {materialAdvantage > 0 ? '+' : ''}{materialAdvantage}
          </div>
        )}
      </div>
      
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold mb-1">Pezzi Neri Catturati:</h3>
        <div className="flex flex-wrap gap-1">
          {ChessUtils.sortPiecesByValue(blackCaptured).map((piece, index) => (
            <span key={index} className="text-2xl">{ChessUtils.renderCapturedPiece(piece, false)}</span>
          ))}
          {blackCaptured.length === 0 && <span className="text-sm text-gray-500">Nessuno</span>}
        </div>
      </div>
    </div>
  );
};

// Componente per mostrare i controlli della partita
export const GameControls: React.FC<{ 
  moves: MoveDetail[];
  currentMove: number;
  onMoveChange: (move: number) => void;
  autoPlay: boolean;
  setAutoPlay: (play: boolean) => void;
  playbackSpeed?: number;
  setPlaybackSpeed?: (speed: number) => void;
}> = ({ 
  moves, 
  currentMove, 
  onMoveChange,
  autoPlay,
  setAutoPlay,
  playbackSpeed = 1.5,
  setPlaybackSpeed
}) => {
  return (
    <div className="mt-4 flex flex-col items-center">
      <div className="flex items-center flex-wrap gap-2 mb-4">
        <button 
          onClick={() => onMoveChange(0)} 
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          disabled={currentMove === 0}
        >
          <span className="text-xs">⏮</span> Inizio
        </button>
        <button 
          onClick={() => onMoveChange(currentMove - 1)} 
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          disabled={currentMove === 0}
        >
          <span className="text-xs">⏪</span> Prec
        </button>
        <button 
          onClick={() => {
            setAutoPlay(!autoPlay);
          }} 
          className={`px-3 py-1 ${autoPlay ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded text-sm`}
        >
          {autoPlay ? '⏸ Pausa' : '▶ Play'}
        </button>
        <button 
          onClick={() => onMoveChange(currentMove + 1)} 
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          disabled={currentMove === moves.length}
        >
          Succ <span className="text-xs">⏩</span>
        </button>
        <button 
          onClick={() => onMoveChange(moves.length)} 
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          disabled={currentMove === moves.length}
        >
          Fine <span className="text-xs">⏭</span>
        </button>
        
        {setPlaybackSpeed && (
          <div className="flex items-center ml-2">
            <span className="text-xs mr-1">Velocità:</span>
            <select 
              value={playbackSpeed} 
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="px-1 py-1 text-xs border rounded"
            >
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
              <option value="3">3x</option>
            </select>
          </div>
        )}
      </div>
      
      <div className="w-full max-w-md h-32 overflow-y-auto border p-2 bg-white">
        <div className="grid grid-cols-7 gap-2">
          {moves.map((move, index) => (
            <React.Fragment key={index}>
              {index % 2 === 0 && (
                <div className="text-gray-600 font-bold">{Math.floor(index / 2) + 1}.</div>
              )}
              <div 
                className={`${currentMove === index + 1 ? 'bg-yellow-200' : ''} 
                            ${move.is_best_move ? 'border-l-4 border-green-500 pl-1' : ''} 
                            ${move.capture ? 'font-semibold' : ''} 
                            ${move.check ? 'text-blue-600' : ''} 
                            ${move.checkmate ? 'text-red-600 font-bold' : ''} 
                            cursor-pointer px-2 py-1 relative rounded hover:bg-gray-100`}
                onClick={() => onMoveChange(index + 1)}
                title={`${move.piece} da ${move.from} a ${move.to}${move.evaluation !== undefined ? ` (${move.evaluation > 0 ? '+' : ''}${move.evaluation})` : ''}`}
              >
                {move.san}
                {move.capture && <span className="absolute top-0 right-0 text-xs text-red-500">×</span>}
                {move.evaluation !== undefined && (
                  <span className={`text-xs ml-1 ${move.evaluation > 0 ? 'text-green-600' : move.evaluation < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {move.evaluation > 0 ? '+' : ''}{move.evaluation}
                  </span>
                )}
              </div>
              {/* Aggiunge una cella vuota dopo la mossa nera per mantenere l'allineamento */}
              {index % 2 === 1 && <div></div>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

// Componente che mostra dettagli della mossa corrente
export const MoveDetails: React.FC<{ 
  move: MoveDetail | null 
}> = ({ move }) => {
  if (!move) return null;
  
  return (
    <div className="mt-4 bg-gray-100 p-3 rounded-md text-sm">
      <h3 className="font-bold mb-2">Dettagli Mossa {move.moveNumber} ({move.color === 'white' ? 'Bianco' : 'Nero'})</h3>
      <div className="grid grid-cols-2 gap-2">
        <div><span className="font-semibold">Notazione:</span> {move.san}</div>
        <div><span className="font-semibold">Pezzo:</span> {move.piece}</div>
        <div><span className="font-semibold">Da:</span> {move.from}</div>
        <div><span className="font-semibold">A:</span> {move.to}</div>
        {move.capture && <div className="text-red-600 font-semibold">Cattura</div>}
        {move.check && <div className="text-blue-600 font-semibold">Scacco</div>}
        {move.checkmate && <div className="text-red-600 font-semibold">Scacco Matto</div>}
        {move.castling && <div><span className="font-semibold">Arrocco:</span> {move.castling === 'kingside' ? 'Corto' : 'Lungo'}</div>}
        {move.promotion && <div><span className="font-semibold">Promozione a:</span> {move.promotion}</div>}
        {move.evaluation !== undefined && (
          <div>
            <span className="font-semibold">Valutazione:</span> 
            <span className={`${move.evaluation > 0 ? 'text-green-600' : move.evaluation < 0 ? 'text-red-600' : ''} ml-1 font-medium`}>
              {move.evaluation > 0 ? '+' : ''}{move.evaluation}
            </span>
          </div>
        )}
        {move.is_best_move && <div className="text-green-600 font-semibold">Mossa Migliore ✓</div>}
      </div>
    </div>
  );
};

// Componente per l'analisi della posizione
export const PositionAnalysis: React.FC<{
  analysis?: any[];
  currentMoveIndex: number;
  onSelectMove: (moveUci: string) => void;
  onShowOnBoard?: (move: MoveHighlight) => void;
}> = ({ analysis, currentMoveIndex, onSelectMove, onShowOnBoard }) => {
  if (!analysis || !analysis[currentMoveIndex]) {
    return (
      <div className="mt-4 p-3 bg-gray-100 rounded-md">
        <h3 className="font-bold mb-2">Analisi Posizione</h3>
        <p className="text-sm text-gray-600">Nessuna analisi disponibile per questa posizione.</p>
      </div>
    );
  }
  
  const positionAnalysis: PositionAnalysisData = analysis[currentMoveIndex];
  
  // Formatta il valore della valutazione
  const formatEvaluation = (evaluation: number): string => {
    const absEval = Math.abs(evaluation);
    // Se è un vantaggio di matto
    if (absEval > 100) {
      const mateIn = Math.ceil((1000 - absEval) / 10);
      return evaluation > 0 ? `+M${mateIn}` : `-M${mateIn}`;
    }
    return (evaluation > 0 ? "+" : "") + evaluation.toFixed(2);
  };
  
  // Calcola il colore in base alla valutazione
  const getEvaluationColor = (evaluation: number): string => {
    if (evaluation > 1) return "text-green-600";
    if (evaluation < -1) return "text-red-600";
    return "text-gray-700";
  };

  // Crea un highlight per una mossa specifica
  const createHighlightForSuggestedMove = (moveUci: string, evaluation: number, isBest = false, isWorst = false) => {
    // Estrai da e a dalla mossa UCI (es. "e2e4")
    const from = moveUci.substring(0, 2);
    const to = moveUci.substring(2, 4);
    
    // Pezzo e promozione sono informazioni che non abbiamo facilmente dal formato UCI
    // Per semplicità impostiamo un pedone come default
    return ChessUtils.createMoveHighlight(from, to, "pawn", "white", {
      isCapture: false, // Non possiamo saperlo facilmente
      isSuggested: true,
      evaluation: evaluation,
      isBestMove: isBest,
      isWorstMove: isWorst
    });
  };
  
  return (
    <div className="mt-4 bg-gray-100 p-3 rounded-md">
      <h3 className="font-bold mb-2">Analisi Posizione</h3>
      
      {/* Valutazione complessiva */}
      <div className="mb-3 flex items-center">
        <div className="font-semibold mr-2">Valutazione:</div>
        <div className={`${getEvaluationColor(positionAnalysis.evaluation)} font-bold text-lg`}>
          {formatEvaluation(positionAnalysis.evaluation)}
        </div>
      </div>
      
      {/* Migliori mosse */}
      <div className="mb-2">
        <h4 className="font-semibold text-sm mb-1">Mosse migliori:</h4>
        <div className="bg-white p-2 rounded-md">
          {positionAnalysis.bestMoves && positionAnalysis.bestMoves.map((move, index) => (
            <div 
              key={index} 
              className={`flex justify-between items-center p-1 
                ${index === 0 ? 'bg-green-100' : ''} 
                hover:bg-blue-50 rounded-md cursor-pointer mb-1`}
              onClick={() => onSelectMove(move.uci)}
            >
              <div className="flex gap-2">
                <span className="text-gray-500 text-sm">{index + 1}.</span>
                <span className="font-medium">{move.san}</span>
              </div>
              <div className="flex gap-2">
                <span className={getEvaluationColor(move.evaluation)}>
                  {formatEvaluation(move.evaluation)}
                </span>
                {onShowOnBoard && (
                  <button 
                    className="text-blue-500 hover:text-blue-700 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowOnBoard(createHighlightForSuggestedMove(move.uci, move.evaluation, index === 0));
                    }}
                  >
                    👁️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Mosse peggiori */}
      {positionAnalysis.worstMoves && positionAnalysis.worstMoves.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-1">Mosse da evitare:</h4>
          <div className="bg-white p-2 rounded-md">
            {positionAnalysis.worstMoves.map((move, index) => (
              <div 
                key={index} 
                className={`flex justify-between items-center p-1 
                  ${index === 0 ? 'bg-red-100' : ''} 
                  hover:bg-blue-50 rounded-md cursor-pointer mb-1`}
                onClick={() => onSelectMove(move.uci)}
              >
                <div className="flex gap-2">
                  <span className="text-gray-500 text-sm">{index + 1}.</span>
                  <span className="font-medium">{move.san}</span>
                </div>
                <div className="flex gap-2">
                  <span className={getEvaluationColor(move.evaluation)}>
                    {formatEvaluation(move.evaluation)}
                  </span>
                  {onShowOnBoard && (
                    <button 
                      className="text-blue-500 hover:text-blue-700 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowOnBoard(createHighlightForSuggestedMove(move.uci, move.evaluation, false, index === 0));
                      }}
                    >
                      👁️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Componente per visualizzare la barra di valutazione
export const EvaluationBar: React.FC<{
  evaluation: number;
  height?: number;
}> = ({ evaluation, height = 300 }) => {
  // Normalizza la valutazione per usarla nella barra
  // Se > 5 o < -5, consideriamo un vantaggio decisivo
  const normalizedEval = Math.max(-5, Math.min(5, evaluation)) / 5;
  
  // Calcola la percentuale di bianco (50% è pari)
  const whitePercentage = 50 + (normalizedEval * 50);
  
  return (
    <div className="flex flex-col items-center mr-2">
      <div 
        className="w-6 border border-gray-300 rounded-sm overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <div 
          className="w-full bg-white"
          style={{ height: `${whitePercentage}%` }}
        ></div>
        <div 
          className="w-full bg-gray-800"
          style={{ height: `${100 - whitePercentage}%` }}
        ></div>
      </div>
      <div className="text-sm font-medium mt-1">
        <span className={evaluation > 0 ? 'text-green-600' : evaluation < 0 ? 'text-red-600' : ''}>
          {evaluation > 0 ? '+' : ''}{Math.abs(evaluation) > 100 ? 'M' : evaluation.toFixed(1)}
        </span>
      </div>
    </div>
  );
};

// Funzione per classificare una mossa in base alla valutazione
export const getMoveQuality = (evaluation: number, prevEvaluation: number): {
  label: string;
  color: string;
  symbol: string;
} => {
  // Calcola la differenza di valutazione (positiva se la posizione migliora)
  const diff = prevEvaluation - evaluation;
  
  // Per le mosse bianche, un diff positivo è buono
  // Per le mosse nere, un diff negativo è buono
  // Qui assumiamo che la valutazione sia sempre dal punto di vista del bianco
  
  if (Math.abs(diff) < 0.2) {
    return { label: "Mossa da manuale", color: "text-gray-600", symbol: "=" };
  }
  
  if (diff > 2) {
    return { label: "Mossa geniale", color: "text-purple-600", symbol: "!!" };
  }
  
  if (diff > 1) {
    return { label: "Mossa ottima", color: "text-green-600", symbol: "!" };
  }
  
  if (diff > 0.5) {
    return { label: "Buona mossa", color: "text-blue-600", symbol: "!?" };
  }
  
  if (diff < -2) {
    return { label: "Errore grave", color: "text-red-700", symbol: "??" };
  }
  
  if (diff < -1) {
    return { label: "Errore", color: "text-red-500", symbol: "?" };
  }
  
  if (diff < -0.5) {
    return { label: "Imprecisione", color: "text-yellow-600", symbol: "?!" };
  }
  
  return { label: "Mossa da manuale", color: "text-gray-600", symbol: "=" };
};

// Componente che mostra la qualità della mossa
export const MoveQualityIndicator: React.FC<{
  currentEval: number;
  prevEval: number;
  isWhiteMove: boolean;
}> = ({ currentEval, prevEval, isWhiteMove }) => {
  // Per le mosse nere, invertiamo il segno della differenza
  // poiché la valutazione è dal punto di vista del bianco
  const adjustedPrevEval = isWhiteMove ? prevEval : -prevEval;
  const adjustedCurrentEval = isWhiteMove ? currentEval : -currentEval;
  
  const quality = getMoveQuality(adjustedCurrentEval, adjustedPrevEval);
  
  return (
    <div className="mt-2">
      <div className={`font-semibold ${quality.color}`}>
        {quality.label} <span className="text-lg">{quality.symbol}</span>
      </div>
      <div className="text-sm text-gray-600">
        Valutazione precedente: {isWhiteMove ? (prevEval > 0 ? '+' : '') : (prevEval < 0 ? '+' : '')}{Math.abs(prevEval).toFixed(2)}
      </div>
      <div className="text-sm text-gray-600">
        Valutazione attuale: {isWhiteMove ? (currentEval > 0 ? '+' : '') : (currentEval < 0 ? '+' : '')}{Math.abs(currentEval).toFixed(2)}
      </div>
    </div>
  );
};
export const GameSummary: React.FC<{
  game: {
    white: { username: string, rating: number },
    black: { username: string, rating: number },
    result: string,
    timeControl: string,
    moves: MoveDetail[]
  }
}> = ({ game }) => {
  return (
    <div className="mb-4 p-4 bg-gray-100 rounded-md shadow-sm">
      <div className="flex justify-between mb-3">
        <div className="flex items-center">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mr-2">♔</div>
          <div>
            <div className="font-medium">{game.white.username}</div>
            {game.white.rating > 0 && (
              <div className="text-sm text-gray-600">{game.white.rating}</div>
            )}
          </div>
        </div>
        <div className="text-center">
          <div className="font-bold">vs</div>
          <div className="text-sm font-medium">{game.result}</div>
        </div>
        <div className="flex items-center">
          <div className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center mr-2">♚</div>
          <div>
            <div className="font-medium">{game.black.username}</div>
            {game.black.rating > 0 && (
              <div className="text-sm text-gray-600">{game.black.rating}</div>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
        <div><span className="font-medium">Mosse:</span> {game.moves.length}</div>
        {game.timeControl !== "Sconosciuto" && (
          <div><span className="font-medium">Tempo:</span> {game.timeControl}</div>
        )}
      </div>
    </div>
  );
};
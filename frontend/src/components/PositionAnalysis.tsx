// PositionAnalysis.tsx - Componente per visualizzare l'analisi di una posizione
import React from 'react';

interface AnalysisMove {
  uci: string;      // Mossa in formato UCI
  san: string;      // Mossa in formato SAN
  evaluation: number; // Valutazione della mossa
}

interface PositionAnalysisProps {
  analysis?: any[];
  currentMoveIndex: number;
  onSelectMove: (moveUci: string) => void;
}

const PositionAnalysis: React.FC<PositionAnalysisProps> = ({ 
  analysis, 
  currentMoveIndex, 
  onSelectMove 
}) => {
  if (!analysis || !analysis[currentMoveIndex]) {
    return (
      <div className="mt-4 p-3 bg-gray-100 rounded-md">
        <h3 className="font-bold mb-2">Analisi Posizione</h3>
        <p className="text-sm text-gray-600">Nessuna analisi disponibile per questa posizione.</p>
      </div>
    );
  }
  
  const positionAnalysis = analysis[currentMoveIndex];
  
  // Formatta il valore della valutazione
  const formatEvaluation = (evaluation: number): string => {
    // Se è un vantaggio di matto
    if (Math.abs(evaluation) > 100) {
      // Converti in "M" seguito dal numero di mosse al matto
      const mateIn = Math.ceil((1000 - Math.abs(evaluation)) / 10);
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
          {positionAnalysis.bestMoves.map((move: AnalysisMove, index: number) => (
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
              <span className={getEvaluationColor(move.evaluation)}>
                {formatEvaluation(move.evaluation)}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Mosse peggiori */}
      {positionAnalysis.worstMoves && positionAnalysis.worstMoves.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-1">Mosse da evitare:</h4>
          <div className="bg-white p-2 rounded-md">
            {positionAnalysis.worstMoves.map((move: AnalysisMove, index: number) => (
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
                <span className={getEvaluationColor(move.evaluation)}>
                  {formatEvaluation(move.evaluation)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Grafico della valutazione (opzionale) */}
      {/* Si potrebbe aggiungere un grafico che mostra la valutazione nel tempo */}
      
      {/* Spiegazione testuale dell'analisi */}
      <div className="mt-3 text-sm">
        <h4 className="font-semibold mb-1">Suggerimenti:</h4>
        <p className="text-gray-800">
          {positionAnalysis.evaluation > 1 ? (
            "Il bianco ha un vantaggio significativo. Cerca di mantenere la pressione."
          ) : positionAnalysis.evaluation < -1 ? (
            "Il nero ha un vantaggio significativo. Difenditi con attenzione."
          ) : (
            "La posizione è equilibrata. Cerca di controllare il centro."
          )}
        </p>
        
        {positionAnalysis.bestMoves.length > 0 && (
          <p className="mt-1 text-gray-800">
            La mossa consigliata è <strong>{positionAnalysis.bestMoves[0].san}</strong> che 
            {positionAnalysis.bestMoves[0].evaluation > 0 
              ? " mantiene o aumenta il vantaggio"
              : positionAnalysis.bestMoves[0].evaluation < -1
                ? " limita lo svantaggio"
                : " mantiene l'equilibrio"
            }.
          </p>
        )}
        
        {positionAnalysis.worstMoves && positionAnalysis.worstMoves.length > 0 && (
          <p className="mt-1 text-gray-800">
            Evita la mossa <strong>{positionAnalysis.worstMoves[0].san}</strong> poiché 
            porterebbe a {positionAnalysis.worstMoves[0].evaluation < -1 
              ? "un significativo svantaggio" 
              : "perdere l'iniziativa"}.
          </p>
        )}
      </div>
    </div>
  );
};

export default PositionAnalysis;// PositionAnalysis.tsx - Componente per visualizzare l'analisi di una posizione

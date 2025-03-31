import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Chess } from 'chess.js';
import { 
  ChessGame, 
  //MoveDetail, 
  MoveHighlight,
  PositionAnalysisData 
} from './types';
import { ChessUtils } from './utils';
import {
  Chessboard,
  CapturedPieces,
  GameControls,
  MoveDetails,
  PositionAnalysis,
  GameSummary,
  MoveQualityIndicator,
  //EvaluationBar
} from './components';

const Home: React.FC = () => {
  const [gameUrl, setGameUrl] = useState<string>('');
  const [gameData, setGameData] = useState<ChessGame | null>(null);
  const [currentMove, setCurrentMove] = useState<number>(0);
  const [moveHighlight, setMoveHighlight] = useState<MoveHighlight | null>(null);
  const [suggestedMoves, setSuggestedMoves] = useState<{
    best?: MoveHighlight[],
    worst?: MoveHighlight[]
  }>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.5);
  const [analyzeGame, setAnalyzeGame] = useState<boolean>(false);
  const [analyzingPosition, setAnalyzingPosition] = useState<boolean>(false);
  const [showSuggestedMoves, setShowSuggestedMoves] = useState<boolean>(true);
  const [showingBestMove, setShowingBestMove] = useState<boolean>(false);
  const [previousPositionEval, setPreviousPositionEval] = useState<number | null>(null);
  
  // URL dell'API backend
  const API_URL = "http://localhost:8000"; // Cambia questo con l'URL del tuo backend
  
  // URL dell'API backend
  //const API_URL = "https://3452-2a01-e11-5013-d640-f411-14d7-2d98-417.ngrok-free.app"; // URL ngrok del backend
  // Funzione per recuperare i dati della partita dal backend
  const fetchGameData = async () => {
    if (!gameUrl.trim()) {
      setError("Inserisci un URL valido di una partita di Chess.com");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Chiama l'API backend con l'URL completo e il flag analyze
      const response = await axios.post(
        `${API_URL}/api/chess/url`, 
        { url: gameUrl },
        { params: { analyze: analyzeGame } }
      );
      
      if (response.data) {
        setGameData(response.data);
        setCurrentMove(0);
        setMoveHighlight(null);
        setSuggestedMoves({});
        setPreviousPositionEval(null);
        setShowingBestMove(false);
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(`Errore: ${err.response.data.detail || 'Si è verificato un errore durante il recupero dei dati'}`);
      } else {
        setError('Errore di connessione al server. Assicurati che il backend sia in esecuzione.');
      }
      console.error('Errore nel recupero della partita:', err);
    } finally {
      setLoading(false);
    }
  };

  // Analizza una posizione specifica
  const analyzePosition = async (fen: string, moveIndex: number) => {
    if (!gameData) return;
    
    setAnalyzingPosition(true);
    
    try {
      const response = await axios.post(`${API_URL}/api/chess/evaluate`, {
        fen: fen,
        depth: 4  // Profondità aumentata per migliore precisione
      });
      
      if (response.data && gameData) {
        // Se non esiste array di analisi, crealo
        if (!gameData.analysis) {
          gameData.analysis = [];
        }
        
        // Assicurati che sia grande abbastanza
        while (gameData.analysis.length <= moveIndex) {
          gameData.analysis.push(null);
        }
        
        // Aggiorna l'analisi per questa posizione
        gameData.analysis[moveIndex] = response.data;
        setGameData({...gameData});
        
        // Aggiorna le mosse suggerite per visualizzarle sulla scacchiera
        if (showSuggestedMoves || showingBestMove) {
          updateSuggestedMoves(response.data);
        }
      }
    } catch (err) {
      console.error('Errore nell\'analisi della posizione:', err);
    } finally {
      setAnalyzingPosition(false);
    }
  };

  // Aggiorna le mosse suggerite per la visualizzazione sulla scacchiera
  const updateSuggestedMoves = (analysisData: PositionAnalysisData) => {
    if (!analysisData || (!showSuggestedMoves && !showingBestMove)) {
      setSuggestedMoves({});
      return;
    }
    
    const best: MoveHighlight[] = [];
    const worst: MoveHighlight[] = [];
    
    // Aggiungi le migliori mosse (massimo 2)
    if (analysisData.bestMoves && analysisData.bestMoves.length > 0) {
      // Se stiamo mostrando la mossa migliore, mostriamo solo la prima
      // Altrimenti, mostriamo fino a 2 mosse se showSuggestedMoves è attivo
      const maxMoves = showingBestMove ? 1 : (showSuggestedMoves ? 2 : 0);
      
      for (let i = 0; i < Math.min(maxMoves, analysisData.bestMoves.length); i++) {
        const move = analysisData.bestMoves[i];
        const from = move.uci.substring(0, 2);
        const to = move.uci.substring(2, 4);
        
        best.push(ChessUtils.createMoveHighlight(from, to, "pawn", "white", {
          evaluation: move.evaluation,
          isBestMove: i === 0,  // Solo la prima è la migliore in assoluto
          isSuggested: i > 0,   // Le altre sono solo suggerite
          isFromBestMove: true  // Per mostrare anche la casella di partenza
        }));
      }
    }
    
    // Aggiungi le peggiori mosse (massimo 1), ma solo se non stiamo mostrando solo la mossa migliore
    if (showSuggestedMoves && !showingBestMove && analysisData.worstMoves && analysisData.worstMoves.length > 0) {
      const move = analysisData.worstMoves[0];
      const from = move.uci.substring(0, 2);
      const to = move.uci.substring(2, 4);
      
      worst.push(ChessUtils.createMoveHighlight(from, to, "pawn", "white", {
        evaluation: move.evaluation,
        isWorstMove: true
      }));
    }
    
    setSuggestedMoves({ best, worst });
  };

  // Gestione del cambio mossa
  const handleMoveChange = useCallback((moveIndex: number) => {
    if (!gameData || moveIndex < 0 || moveIndex > gameData.moves.length) return;
    
    // Salva la valutazione precedente prima di cambiare mossa
    if (gameData.analysis && gameData.analysis[currentMove]) {
      setPreviousPositionEval(gameData.analysis[currentMove].evaluation);
    }
    
    setCurrentMove(moveIndex);
    
    // Resetta lo stato di visualizzazione della mossa migliore
    setShowingBestMove(false);
    
    // Se abbiamo l'analisi e ci sono suggerimenti, aggiorniamoli
    if (gameData.analysis && gameData.analysis[moveIndex] && showSuggestedMoves) {
      updateSuggestedMoves(gameData.analysis[moveIndex]);
    } else {
      setSuggestedMoves({});
    }
    
    // Aggiorna l'evidenziazione della mossa corrente
    if (moveIndex > 0) {
      const move = gameData.moves[moveIndex - 1];
      
      setMoveHighlight(ChessUtils.createMoveHighlight(
        move.from,
        move.to,
        move.piece,
        move.color,
        {
          isCapture: move.capture,
          isCheck: move.check,
          isCheckmate: move.checkmate,
          promotion: move.promotion,
          castling: move.castling,
          evaluation: move.evaluation
        }
      ));
      
      // Se abbiamo l'analisi attiva, analizza questa posizione se non è già stata analizzata
      if (analyzeGame && gameData.positions && gameData.positions[moveIndex]) {
        if (!gameData.analysis || !gameData.analysis[moveIndex]) {
          analyzePosition(gameData.positions[moveIndex], moveIndex);
        }
      }
    } else {
      setMoveHighlight(null);
    }
  }, [gameData, analyzeGame, showSuggestedMoves, currentMove]);

  // Gestisci la visualizzazione della mossa migliore
  const handleToggleBestMove = () => {
    if (!gameData || !gameData.analysis || !gameData.analysis[currentMove]) {
      // Se non abbiamo l'analisi, analizza questa posizione
      if (gameData && gameData.positions && currentMove < gameData.positions.length) {
        analyzePosition(gameData.positions[currentMove], currentMove);
      }
      return;
    }
    
    const newShowingState = !showingBestMove;
    setShowingBestMove(newShowingState);
    
    // Aggiorna le mosse suggerite in base al nuovo stato
    updateSuggestedMoves(gameData.analysis[currentMove]);
  };

  // Funzione per mostrare una mossa suggerita sulla scacchiera
  const handleShowMoveOnBoard = (moveHighlight: MoveHighlight) => {
    // Temporaneamente mostra questa mossa sulla scacchiera
    setMoveHighlight(moveHighlight);
    
    // Ripristina dopo 1.5 secondi
    setTimeout(() => {
      if (currentMove > 0 && gameData) {
        const move = gameData.moves[currentMove - 1];
        setMoveHighlight(ChessUtils.createMoveHighlight(
          move.from, 
          move.to, 
          move.piece, 
          move.color, 
          {
            isCapture: move.capture,
            isCheck: move.check,
            isCheckmate: move.checkmate,
            promotion: move.promotion,
            castling: move.castling
          }
        ));
      } else {
        setMoveHighlight(null);
      }
    }, 1500);
  };

  // Applica una mossa suggerita (quando si fa clic su una mossa suggerita dall'analisi)
  const handleSuggestedMove = (moveUci: string) => {
    try {
      if (gameData && currentMove < gameData.positions.length) {
        // Crea una scacchiera dalla posizione corrente
        const board = new Chess(gameData.positions[currentMove]);
        
        // Trova la mossa in formato UCI
        for (const move of board.moves({ verbose: true })) {
          if (move.from + move.to + (move.promotion || '') === moveUci) {
            // Crea un highlight per questa mossa
            const fromPos = ChessUtils.algebraicToIndices(move.from);
            const toPos = ChessUtils.algebraicToIndices(move.to);
            
            const highlightMove: MoveHighlight = {
              fromRow: fromPos.row,
              fromCol: fromPos.col,
              toRow: toPos.row,
              toCol: toPos.col,
              piece: move.piece.toUpperCase() as any,
              isCapture: !!move.captured,
              isCheck: board.isCheck(),
              isCheckmate: false,
              promotion: move.promotion as any,
              isSuggested: true
            };
            
            setMoveHighlight(highlightMove);
            
            break;
          }
        }
      }
    } catch (err) {
      console.error('Errore nell\'applicazione della mossa suggerita:', err);
    }
  };

  // Effetto per la riproduzione automatica
  useEffect(() => {
    let interval: number | null = null;
    
    if (autoPlay && gameData && currentMove < gameData.moves.length) {
      interval = window.setInterval(() => {
        setCurrentMove(prev => {
          // Se siamo all'ultima mossa, ferma la riproduzione automatica
          if (prev >= gameData.moves.length) {
            setAutoPlay(false);
            return prev;
          }
          return prev + 1;
        });
      }, playbackSpeed * 1000); // Velocità regolabile
    }
    
    return () => {
      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }, [autoPlay, currentMove, gameData, playbackSpeed]);

  // Aggiorna l'evidenziazione quando cambia la mossa corrente
  useEffect(() => {
    if (gameData) {
      handleMoveChange(currentMove);
    }
  }, [currentMove, gameData, handleMoveChange]);

  // Ottieni la valutazione corrente
  const getCurrentEvaluation = (): number | undefined => {
    if (gameData?.analysis && gameData.analysis[currentMove]) {
      return gameData.analysis[currentMove].evaluation;
    }
    return undefined;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Visualizzatore di Partite di Scacchi</h1>
      
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-lg">
        <div className="mb-6">
          <label htmlFor="gameUrl" className="block text-sm font-medium text-gray-700 mb-2">
            Inserisci l'URL della partita di Chess.com:
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              id="gameUrl"
              value={gameUrl}
              onChange={(e) => setGameUrl(e.target.value)}
              placeholder="https://www.chess.com/game/live/136832121294"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={fetchGameData}
              disabled={loading || !gameUrl.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
            >
              {loading ? 'Caricamento...' : 'Visualizza'}
            </button>
          </div>
          
          <div className="mt-2 flex items-center space-x-4 flex-wrap">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="analyzeGame"
                checked={analyzeGame}
                onChange={(e) => setAnalyzeGame(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="analyzeGame" className="text-sm text-gray-700">
                Analizza la partita
              </label>
            </div>
            
            {analyzeGame && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showSuggestions"
                  checked={showSuggestedMoves}
                  onChange={(e) => {
                    setShowSuggestedMoves(e.target.checked);
                    if (gameData?.analysis && gameData.analysis[currentMove]) {
                      updateSuggestedMoves(gameData.analysis[currentMove]);
                    }
                  }}
                  className="mr-2"
                />
                <label htmlFor="showSuggestions" className="text-sm text-gray-700">
                  Mostra suggerimenti sulla scacchiera
                </label>
              </div>
            )}
          </div>
          
          {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
          {loading && <p className="mt-2 text-blue-600 text-sm">Estrazione delle mosse in corso, potrebbe richiedere alcuni secondi...</p>}
        </div>

        {gameData && gameData.positions && (
          <div>
            {/* Riepilogo della partita */}
            <GameSummary game={gameData} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Colonna sinistra: Scacchiera e controlli */}
              <div>
                {/* La chiave forza il rerendering quando cambia la mossa */}
                <div key={`board-state-${currentMove}-${showingBestMove}`} className="mb-4">
                  <Chessboard 
                    fen={gameData.positions[currentMove]} 
                    highlight={moveHighlight}
                    suggestedMoves={showSuggestedMoves || showingBestMove ? suggestedMoves : {}}
                    onShowBestMove={analyzeGame ? handleToggleBestMove : undefined}
                    showingBestMove={showingBestMove}
                    currentEvaluation={getCurrentEvaluation()}
                  />
                </div>
                
                <GameControls 
                  moves={gameData.moves} 
                  currentMove={currentMove} 
                  onMoveChange={handleMoveChange}
                  autoPlay={autoPlay}
                  setAutoPlay={setAutoPlay}
                  playbackSpeed={playbackSpeed}
                  setPlaybackSpeed={setPlaybackSpeed}
                />
                
                {/* Pezzi catturati */}
                <CapturedPieces 
                  moves={gameData.moves} 
                  currentMoveIndex={currentMove} 
                />
              </div>
              
              {/* Colonna destra: Dettagli mossa e analisi */}
              <div>
                {/* Dettagli della mossa corrente */}
                {currentMove > 0 && (
                  <MoveDetails move={gameData.moves[currentMove - 1]} />
                )}
                
                {/* Qualità della mossa */}
                {currentMove > 0 && previousPositionEval !== null && getCurrentEvaluation() !== undefined && (
                  <div className="mt-4">
                    <MoveQualityIndicator 
                      currentEval={getCurrentEvaluation() as number} 
                      prevEval={previousPositionEval}
                      isWhiteMove={gameData.moves[currentMove - 1].color === 'white'}
                    />
                  </div>
                )}
                
                {/* Analisi della posizione */}
                {analyzeGame && (
                  <>
                    {analyzingPosition ? (
                      <div className="mt-4 p-3 bg-gray-100 rounded-md text-sm text-center">
                        <div className="flex justify-center items-center">
                          <svg className="animate-spin h-5 w-5 mr-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Analisi in corso...
                        </div>
                      </div>
                    ) : (
                      <PositionAnalysis
                        analysis={gameData.analysis}
                        currentMoveIndex={currentMove}
                        onSelectMove={handleSuggestedMove}
                        onShowOnBoard={handleShowMoveOnBoard}
                      />
                    )}
                    
                    {gameData.analysis && !gameData.analysis[currentMove] && !analyzingPosition && (
                      <button
                        onClick={() => analyzePosition(gameData.positions[currentMove], currentMove)}
                        className="mt-2 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Analizza questa posizione
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
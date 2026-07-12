import '../App.css';
import TopBar from '../common/TopBar';
import Container from '../common/Container';
import GameInstruction from '../common/GameInstruction';
import PlayerContainer from '../common/Players';
import { useState } from 'react';
import Generate from '../common/Generate';
import Voting from '../common/Voting';
import RevealPrompt from '../common/RevealPrompt';
import Result from '../common/Result';
import ReferenceImage from '../common/ReferenceImage';
import sio from '../common/websocket';
import { useEffect } from 'react';
import { StageSpinner } from 'react-spinners-kit';
import GameResult from './GameResult';
import axios from 'axios';
import { useParams, useLocation } from 'react-router-dom';

export default function PlayGame() {
  const [currentTurn, setCurrentTurn] = useState(0);
  const [showModal, setShowModal] = useState(true);
  const [gameOver, setGameOver] = useState(false);  // game-over state
  const { gameCode } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const playerName = searchParams.get('player');
  const isHost = searchParams.get('host') === 'true';
  const [round, setRound] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);  // track the reconnection state
  const [gameStarted, setGameStarted] = useState(false);  // track whether the game has actually started
  const [codeCopied, setCodeCopied] = useState(false);
  const [numPlayers, setNumPlayers] = useState(0);  // live count of players who have joined the room

  const handleEndGame = () => {
    if (window.confirm('End the game for everyone now? This cannot be undone.')) {
      sio.emit('end-game', { room_id: gameCode });
    }
  };

  const handleStartGame = () => {
    sio.emit('start-game', { room_id: gameCode });
  };

  const handleNextStage = () => {
    sio.emit('force-advance', { room_id: gameCode });
  };

  const handleCopyGameCode = async () => {
    try {
      await navigator.clipboard.writeText(gameCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy game code:', error);
    }
  };

  // Handle reconnection on every socket connect (including transport upgrades)
  useEffect(() => {
    const attemptReconnect = async () => {
      // Get session token using gameCode and playerName from URL
      const sessionKey = playerName ? `session_${gameCode}_${playerName}` : 'session_token';
      const sessionToken = localStorage.getItem(sessionKey);

      if (sessionToken && sio.id) {
        console.log(`🔍 Attempting reconnection with key: ${sessionKey}, SID: ${sio.id}`);
        setReconnecting(true);
        try {
          const response = await axios.post('/api/reconnect', {
            session_token: sessionToken,
            sid: sio.id,
          });

          if (response.data.success) {
            console.log('🔄 Successfully reconnected:', response.data);
            // Verify we're in the right room
            if (response.data.room_id === gameCode) {
              console.log('✅ Reconnection successful, staying in game');

              // Trigger Socket.IO events to refresh game state
              sio.emit('get-players', { room_id: gameCode });

              // If room data is available, restore state immediately
              if (response.data.room && response.data.room.game_state) {
                const gameState = response.data.room.game_state;
                console.log('📊 Restoring game state:', {
                  round: gameState.current_round,
                  turn: gameState.current_turn,
                  started_at: gameState.started_at
                });

                // Check if game has actually started (not just waiting for players)
                if (gameState.started_at) {
                  console.log(`🎮 Game has started at: ${gameState.started_at}`);
                  setGameStarted(true);
                  // the 'game-started' socket event only fires once, when the host
                  // originally starts the game - a reconnect (e.g. mobile tab getting
                  // reloaded after being backgrounded) never sees it, so the lobby
                  // modal's default-true state must be cleared explicitly here too
                  setShowModal(false);
                } else {
                  console.log(`⏳ Game not yet started, still waiting for players`);
                  setGameStarted(false);
                }

                // Immediately sync the current turn to match backend state
                if (gameState.current_turn !== undefined) {
                  console.log(`🔄 Syncing currentTurn from backend: ${gameState.current_turn}`);
                  setCurrentTurn(gameState.current_turn);
                }

                // Sync round if available
                if (gameState.current_round !== undefined) {
                  console.log(`🔄 Syncing round from backend: ${gameState.current_round}`);
                  setRound(gameState.current_round);
                }
              }
            } else {
              console.warn('⚠️ Reconnected to different room, redirecting...');
              // Could redirect to correct room here if needed
            }
          } else {
            console.log('❌ Reconnection failed, might be a new session');
          }
        } catch (error) {
          console.error('❌ Reconnection error:', error);
        } finally {
          setReconnecting(false);
        }
      }
    };

    // Listen for every socket connect event (including transport upgrades)
    const handleConnect = () => {
      console.log('🔌 Socket connected, attempting reconnect...');
      // Small delay to ensure socket.id is available
      setTimeout(attemptReconnect, 100);
    };

    // Initial connection attempt
    if (sio.connected) {
      attemptReconnect();
    }

    // Listen for all future connect events (including transport upgrades)
    sio.on('connect', handleConnect);

    return () => {
      sio.off('connect', handleConnect);
    };
  }, [gameCode, playerName]);

  useEffect(() => {
    axios.get(`/api/round-info?room_id=${gameCode}`).then((response) => {
      setRound(response.data.round);
    });
  }, [gameCode]);

  // check if all players are done
  useEffect(() => {
    const handleAllPlayersDone = (data) => {
      if (data.moving_to_next_turn) {
        console.log(`🔄 Turn update: backend sent global_turn ${data.current_turn} (round: ${data.current_round}, round_turn: ${data.round_turn || 'N/A'})`);
        // Use the exact turn value from backend instead of incrementing
        setCurrentTurn(prevTurn => {
          if (prevTurn !== data.current_turn) {
            console.log(`✅ Updating currentTurn: ${prevTurn} -> ${data.current_turn}`);
            return data.current_turn;
          } else {
            console.log(`⚠️ Ignoring duplicate turn update: ${prevTurn}`);
            return prevTurn;
          }
        });
      }
    };

    sio.on('next-turn-ready', handleAllPlayersDone);

    return () => {
      sio.off('next-turn-ready', handleAllPlayersDone);
    };
  }, []);

  // Debug: watch the actual changes of currentTurn
  useEffect(() => {
    console.log(`🎮 Frontend currentTurn changed to: ${currentTurn}`);
  }, [currentTurn]);

  useEffect(() => {
    const handleNumPlayers = (data) => {
      setNumPlayers(data.num_players);
    };

    // listen for the game-start event to ensure the modal is hidden
    const handleGameStarted = (data) => {
      console.log('Game started in PlayGame!', data);
      setShowModal(false);
      setGameStarted(true);  // Mark game as truly started
    };

    // listen for the game-over event
    const handleGameOver = (data) => {
      console.log('🏁 Game over event received:', data);
      setGameOver(true);
    };
    
    sio.on('num_players', handleNumPlayers);
    sio.on('game-started', handleGameStarted);
    sio.on('game_over', handleGameOver);
    
    return () => {
      sio.off('num_players', handleNumPlayers);
      sio.off('game-started', handleGameStarted);
      sio.off('game_over', handleGameOver);
    };
  }, []);

  // removed the frontend's manual timer start; fully managed by the backend
  // useEffect(() => {
  //   if (!isTutorial && currentTurn === 0 && round === 1) {
  //     sio.emit('start-turn-timer');
  //   }
  // }, [round]);

  return (
    <>
      {/* Reconnecting indicator */}
      {reconnecting && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <StageSpinner size={20} color="#ffffff" />
          <span>Reconnecting...</span>
        </div>
      )}

      {showModal && (
        <div className="font-semibold font-inter fixed inset-0 flex items-center justify-center px-4">
          <div className="bg-white p-6 sm:p-8 rounded shadow-md justify-items-center text-lg sm:text-xl border-black border-[2px] text-center max-w-md w-full">
            <StageSpinner loading={true} color="#111111" />
            <p className="mt-4 mb-2">
              {isHost ? 'Waiting for players to join...' : 'Waiting for the host to start the game...'}
            </p>
            <p className="text-base text-gray-600 font-normal mb-4">
              {numPlayers} player{numPlayers !== 1 ? 's' : ''} joined
            </p>
            <p className="text-base text-gray-600 font-normal mb-2">Share this game code:</p>
            <p className="text-3xl sm:text-4xl font-bold tracking-widest mb-4 break-all">{gameCode}</p>
            <button
              onClick={handleCopyGameCode}
              className="mb-4 px-4 py-2 bg-[#111111] text-white rounded-lg text-base font-normal hover:bg-gray-800 transition-colors"
            >
              {codeCopied ? 'Copied!' : 'Copy code'}
            </button>
            <p className="text-sm text-gray-600 font-normal mb-4">
              Others can join from the home page and enter this code
            </p>
            {isHost && (
              <button
                onClick={handleStartGame}
                disabled={numPlayers < 2}
                className={`px-6 py-2 rounded-lg text-base font-semibold transition-colors ${
                  numPlayers < 2
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {numPlayers < 2 ? 'Need at least 2 players' : 'Start Game'}
              </button>
            )}
          </div>
        </div>
      )}
                      {gameOver || currentTurn === 24 ? (
        <GameResult />
      ) : (
        <>
          <div className="flex flex-col lg:grid lg:grid-cols-4">
            <div className="flex flex-wrap items-center justify-between gap-2 lg:contents">
              <TopBar />
              <div className="relative z-[60] flex items-center gap-2 sm:gap-3 mt-4 mr-4 lg:mt-8 lg:mr-8 lg:col-start-4 lg:justify-self-end">
                {isHost && !gameOver && currentTurn !== 24 && (
                  <button
                    onClick={handleNextStage}
                    className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white text-xs sm:text-base lg:text-[1.25rem] font-semibold rounded-[0.5rem] shadow hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Next Stage
                  </button>
                )}
                {isHost && !gameOver && currentTurn !== 24 && (
                  <button
                    onClick={handleEndGame}
                    className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-red-600 text-white text-xs sm:text-base lg:text-[1.25rem] font-semibold rounded-[0.5rem] shadow hover:bg-red-700 transition-colors whitespace-nowrap"
                  >
                    End Game
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 mx-4 lg:mt-7 lg:ml-8 lg:mr-0 grid grid-cols-1 content-between lg:h-full">
              <PlayerContainer />
            </div>
            <div className="mt-4 mx-4 mb-4 lg:mt-0 lg:mx-0 lg:mb-0 lg:col-start-2 lg:col-span-full lg:m-7 lg:h-full">
              {currentTurn % 4 === 3 ? (
                // Result component gets full height and relative positioning
                <div className="h-full relative">
                  <Result />
                </div>
              ) : (
                <Container>
                  <GameInstruction currentTurn={currentTurn}></GameInstruction>
                  <div className="mt-7">
                    {/* new 4-phase flow: Generate -> Voting -> Reveal -> Result */}
                    {currentTurn % 4 === 0 ? (
                      <Generate currentTurn={currentTurn} gameStarted={gameStarted} />
                    ) : currentTurn % 4 === 1 ? (
                      <Voting />
                    ) : currentTurn % 4 === 2 ? (
                      <RevealPrompt />
                    ) : null}
                  </div>
                </Container>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

import '../App.css';
import TopBar from '../common/TopBar';
import Container from '../common/Container';
import BackButton from '../common/BackButton';
import GameConfigModal from '../common/GameConfigModal';
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import socket from '../common/websocket';

export default function JoinGame() {
  const [randomNumber] = useState(Math.floor(Math.random() * 100000));
  const gameCode = randomNumber.toString();
  const playerNameRef = useRef();
  const navigate = useNavigate();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [gameConfig, setGameConfig] = useState({
    selectedCategories: ['cultural', 'demographic', 'biological', 'co-occurrence', 'realism', 'number & spatial'],
    apiKey: ''
  });
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`imaginaition.com/${gameCode}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(gameCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy game code:', error);
    }
  };

  // Compute API key validity without causing re-renders
  const isApiKeyValid = apiKey && apiKey.trim() !== '' && apiKey.startsWith('sk-') && apiKey.length >= 20;

  const validateApiKey = (key) => {
    if (!key || key.trim() === '') {
      setApiKeyError('OpenAI API key is required');
      return false;
    }
    if (!key.startsWith('sk-')) {
      setApiKeyError('API key must start with "sk-"');
      return false;
    }
    if (key.length < 20) {
      setApiKeyError('API key appears to be too short');
      return false;
    }
    setApiKeyError('');
    return true;
  };

  const handleStartGame = async () => {
    if (!validateApiKey(apiKey)) {
      return;
    }

    // Wait for socket connection if not connected
    if (!socket.connected) {
      console.log('⏳ Waiting for Socket.IO connection...');
      await new Promise((resolve) => {
        if (socket.connected) {
          resolve();
        } else {
          socket.once('connect', resolve);
          // Timeout after 5 seconds
          setTimeout(() => {
            if (!socket.connected) {
              alert('Failed to connect to server. Please refresh the page.');
            }
            resolve();
          }, 5000);
        }
      });
    }

    if (!socket.id || !gameCode) {
      alert('Missing socket ID or game code!');
      return;
    }

    axios
      .post('/api/create-room', {
        sid: socket.id,
        room_id: gameCode.toString(),
        player_name: playerNameRef.current.value,
        tutorial: false,
        categories: gameConfig.selectedCategories,
        api_key: apiKey,
      }) // Sending correct JSON
      .then((response) => {
        if (response.status !== 200) {
          console.error('❌ Axios error:', response);
          return;
        }
        // Store session token for reconnection with unique key per player
        const playerName = playerNameRef.current.value;
        if (response.data.session_token) {
          const sessionKey = `session_${gameCode}_${playerName}`;
          localStorage.setItem(sessionKey, response.data.session_token);
          console.log(`🔑 Session token stored: ${sessionKey}`);
        }
        // Navigate with player name in URL for multi-tab support; `host=true` marks
        // this tab as the room creator so PlayGame can show the "End Game" control
        navigate(`/play/${gameCode}?player=${encodeURIComponent(playerName)}&host=true`);
      })
      .catch((error) => {
        console.error(
          '❌ Axios error:',
          error.response ? error.response.data : error
        );

        // Check if it's an API key related error
        if (error.response?.status === 401 ||
            (error.response?.data && error.response.data.toString().includes('API key'))) {
          setApiKeyError('Invalid API key. Please check your OpenAI API key.');
        } else {
          alert('Failed to create room. Please try again.');
        }
      });
  };
  return (
    <div className="min-h-svh flex flex-col">
      <div className="-z-10">
        <TopBar />
      </div>
      <div className="flex-1 items-center flex py-6">
        <div className="main-container font-inter w-full">
          <Container>
            <BackButton />
            <div className="flex flex-col items-center px-5 sm:px-8 pb-8">
              <div className="w-full max-w-xl flex flex-wrap items-center justify-between gap-3 mb-6">
                <h1 className="font-gooper font-bold text-[1.75rem] sm:text-[2.5rem]">
                  Start a Game
                </h1>
                <button
                  onClick={() => setIsConfigModalOpen(true)}
                  className="shrink-0 text-base sm:text-lg bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg border"
                  title="Game Configuration"
                >
                  ⚙️ Config
                </button>
              </div>

              <div className="w-full max-w-xl">
                {/* Share card: link + code, each with a working copy button */}
                <div className="bg-[#F5F5F5] rounded-2xl p-4 sm:p-6 mb-6">
                  <p className="text-base sm:text-lg font-semibold text-gray-600 mb-1">
                    Invite link
                  </p>
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 min-w-0 bg-white border border-[#D3D3D3] rounded-xl px-4 py-3 text-base sm:text-lg truncate">
                      imaginaition.com/{gameCode}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="shrink-0 px-4 py-3 bg-black text-white rounded-xl text-sm sm:text-base font-semibold hover:bg-gray-800 transition-colors"
                    >
                      {linkCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <p className="text-base sm:text-lg font-semibold text-gray-600 mb-1">
                    Game code
                  </p>
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 bg-white border border-[#D3D3D3] rounded-xl px-4 py-3 text-xl sm:text-2xl font-bold tracking-widest text-center">
                      {gameCode}
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="shrink-0 px-4 py-3 bg-black text-white rounded-xl text-sm sm:text-base font-semibold hover:bg-gray-800 transition-colors"
                    >
                      {codeCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <p className="text-base sm:text-lg text-gray-600">
                    {gameConfig.selectedCategories.length} rounds · {gameConfig.selectedCategories.length} categories
                  </p>
                </div>

                {/* OpenAI API Key Section */}
                <div className="mb-6">
                  <label
                    htmlFor="api-key"
                    className="mb-2 text-lg sm:text-xl font-semibold block"
                  >
                    OpenAI API Key (Required)
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => {
                        const value = e.target.value;
                        setApiKey(value);

                        // Update error message based on current value
                        if (!value || value.trim() === '') {
                          setApiKeyError('OpenAI API key is required');
                        } else if (!value.startsWith('sk-')) {
                          setApiKeyError('API key must start with "sk-"');
                        } else if (value.length < 20) {
                          setApiKeyError('API key appears to be too short');
                        } else {
                          setApiKeyError('');
                        }
                      }}
                      id="api-key"
                      name="api-key"
                      className={`rounded-xl border w-full min-w-0 bg-[#FAFAFA] py-4 pl-4 pr-12 text-lg sm:text-xl ${
                        apiKeyError ? 'border-red-500' : 'border-[#D3D3D3]'
                      }`}
                      placeholder="sk-..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xl"
                    >
                      {showApiKey ? "🙈" : "👁️"}
                    </button>
                  </div>
                  <p className="text-sm sm:text-base text-gray-600 mt-2">
                    Your API key will NOT be stored and is only used for this game session.
                  </p>
                  {apiKeyError && (
                    <p className="text-sm sm:text-base text-red-600 mt-1">{apiKeyError}</p>
                  )}
                </div>

                {/* Player name */}
                <div className="mb-8">
                  <label
                    htmlFor="player-name"
                    className="mb-2 text-lg sm:text-xl font-semibold block"
                  >
                    Your name?
                  </label>
                  <input
                    type="text"
                    ref={playerNameRef}
                    id="player-name"
                    name="player-name"
                    className="rounded-xl border border-[#D3D3D3] w-full min-w-0 bg-[#FAFAFA] py-4 px-4 text-lg sm:text-xl"
                    placeholder="Enter name"
                  ></input>
                </div>

                <button
                  onClick={() => {
                    console.log(playerNameRef.current.value);
                    handleStartGame();
                  }}
                  disabled={!isApiKeyValid}
                  className={`w-full font-medium border rounded-xl text-xl sm:text-2xl py-4 font-gooper transition-colors ${
                    !isApiKeyValid
                      ? 'border-gray-400 text-gray-400 bg-gray-200 cursor-not-allowed'
                      : 'border-black text-[#FFFFFF] bg-[#111111] hover:bg-gray-800'
                  }`}
                >
                  Start Game
                </button>
              </div>
            </div>
          </Container>
        </div>
      </div>

      <GameConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={setGameConfig}
        initialConfig={gameConfig}
      />
    </div>
  );
}

import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import OpenAI from "openai";
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { OPENAI_API_KEY } from "@env";
import { setupDatabase } from './db/database';
import MedicationList from './MedicationList';

// OpenAI Client Setup
if (!OPENAI_API_KEY) {
  console.error("OpenAI API key is missing. Please check your .env file.");
}

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Voice Theme Selector Component
const VoiceThemeSelector = ({ selectedVoice, onVoiceSelected }) => {
  const voiceThemes = {
    alloy: { color: '#6200ee', icon: 'record-voice-over', description: 'Neutral, balanced voice with clear articulation' },
    echo: { color: '#3700b3', icon: 'surround-sound', description: 'Deep, resonant voice with a measured pace' },
    fable: { color: '#03dac4', icon: 'auto-stories', description: 'Warm, friendly voice with expressive tones' },
    onyx: { color: '#333333', icon: 'mic', description: 'Rich, authoritative voice with depth' },
    nova: { color: '#bb86fc', icon: 'stars', description: 'Bright, energetic voice with upbeat delivery' },
    shimmer: { color: '#018786', icon: 'waves', description: 'Soft, gentle voice with a soothing quality' },
  };

  return (
    <View style={styles.voiceThemeContainer}>
      <Text style={styles.voiceThemeTitle}>Select Voice Theme</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.voiceThemeScroll}>
        {Object.entries(voiceThemes).map(([voice, theme]) => (
          <View
            key={voice}
            style={[
              styles.voiceThemeOption,
              { backgroundColor: theme.color },
              selectedVoice === voice && styles.selectedVoiceTheme
            ]}
          >
            <MaterialIcons name={theme.icon} size={24} color="white" />
            <Text style={styles.voiceThemeName}>{voice.charAt(0).toUpperCase() + voice.slice(1)}</Text>
            <Text style={styles.voiceThemeDescription}>{theme.description}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const App = () => {
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [sound, setSound] = useState();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  // Initialize database
  useEffect(() => {
    const initialize = async () => {
      try {
        await setupDatabase();
      } catch (err) {
        console.error("❌ Failed to setup database:", err);
      }
    };
    initialize();
  }, []);

  // Cleanup audio
  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  // Play or Pause Audio
  const togglePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Text style={styles.title}>Medication Manager</Text>
      <Text style={styles.subtitle}>Supporting Older Adults With Safe Medication Use</Text>
  
      <VoiceThemeSelector
        selectedVoice={selectedVoice}
        onVoiceSelected={setSelectedVoice}
      />
  
      <MedicationList />
  
      {audioLoading && (
        <View style={styles.audioLoadingContainer}>
          <ActivityIndicator size="small" color="#841584" />
          <Text style={styles.audioLoadingText}>Generating audio...</Text>
        </View>
      )}
    </SafeAreaView>
  );
  
  
};

// Styles
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  voiceThemeContainer: {
    width: '100%',
    marginBottom: 20,
  },
  voiceThemeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  voiceThemeScroll: {
    width: '100%',
  },
  voiceThemeOption: {
    padding: 15,
    borderRadius: 10,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  selectedVoiceTheme: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  voiceThemeName: {
    color: 'white',
    fontWeight: 'bold',
    marginTop: 5,
    marginBottom: 2,
  },
  voiceThemeDescription: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
  },
  audioLoadingContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioLoadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: 'gray',
  },
});

export default App;

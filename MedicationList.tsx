import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, Switch } from 'react-native'; // Import Switch
import DateTimePicker from '@react-native-community/datetimepicker'; // Import DateTimePicker for time selection
import * as Notifications from 'expo-notifications'; // Import Notifications
import { getDBConnection } from './db/database';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from "@env";

const client = new OpenAI({ apiKey: OPENAI_API_KEY });
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
import { openai } from './openaiClient';

const MedicationList = () => {
  const [medications, setMedications] = useState([]);
  const [logs, setLogs] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [queryModalVisible, setQueryModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    name: '',
    dosage: '',
    schedule: new Date(),  // Store as Date object
    side_effects: '',
    icon: '💊',
    color: '#81d4fa',
    selectedDays: [false, false, false, false, false, false, false], // Store which days are selected
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [doseHistory, setDoseHistory] = useState({});


  const [sound, setSound] = useState();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  const generateAudio = async (text) => {
    if (!text) return;

    setAudioLoading(true);

    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const mp3 = await client.audio.speech.create({
        model: "tts-1",
        voice: "alloy", // static voice for now
        input: text,
      });

      const audioData = await mp3.arrayBuffer();
      const fileUri = FileSystem.cacheDirectory + "temp_audio.mp3";

      await FileSystem.writeAsStringAsync(
        fileUri,
        arrayBufferToBase64(audioData),
        { encoding: FileSystem.EncodingType.Base64 }
      );

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true }
      );

      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });

    } catch (error) {
      console.error("Error generating audio:", error);
      Alert.alert("Audio Error", "Could not generate audio from text.");
    } finally {
      setAudioLoading(false);
    }
  };

  const arrayBufferToBase64 = (buffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const speakMedicationInfo = (med) => {
    const message = `${med.name}, ${med.dosage}. ${med.side_effects ? "Side effects: " + med.side_effects : ""}`;
    generateAudio(message);
  };

  useEffect(() => {
    loadMedicationsAndLogs();
    requestNotificationPermissions();  // Request notification permissions
  }, []);

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const loadMedicationsAndLogs = async () => {
    try {
      const db = getDBConnection();
      const meds = await db.getAllAsync('SELECT * FROM medications');
      const today = getTodayDate();
      const logResults = await db.getAllAsync(
        'SELECT medication_id FROM medication_logs WHERE date = ? AND taken = 1',
        [today]
      );
      const takenMap = {};
      logResults.forEach((entry) => {
        takenMap[entry.medication_id] = true;
      });
      setMedications(meds);
      setLogs(takenMap);

      meds.forEach((med) => scheduleNotification(med.schedule, med.selectedDays)); // Schedule notifications
    } catch (error) {
      Alert.alert('Database Error', 'Unable to fetch medications or logs.');
    }
  };

  const requestNotificationPermissions = async () => {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      status = newStatus;
    }

    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'You need to enable notifications for this app to work.');
    } else {
      console.warn('✅ Notification permissions granted');
    }
  };

  const handleAddMedication = async () => {
    const { name, dosage, schedule, selectedDays, side_effects } = form;
    if (!name || !dosage || !schedule) {
      Alert.alert('Validation Error', 'Name, dosage, and schedule are required.');
      return;
    }

    try {
      const db = getDBConnection();
      await db.runAsync(
        `INSERT INTO medications (name, dosage, schedule, side_effects, icon, color)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [form.name, form.dosage, schedule.toISOString(), side_effects, form.icon, form.color]
      );
      setForm({
        name: '',
        dosage: '',
        schedule: new Date(),
        side_effects: '',
        icon: '💊',
        color: '#81d4fa',
        selectedDays: [false, false, false, false, false, false, false], // Reset days selected
      });
      setModalVisible(false);
      loadMedicationsAndLogs();

      // Schedule notification
      scheduleNotification(schedule, selectedDays);
    } catch (error) {
      Alert.alert('Error', 'Failed to save medication.');
    }
  };

  const handleAskQuestion = async () => {
    if (!query.trim()) {
      Alert.alert('Empty', 'Please enter a question.');
      return;
    }

    try {
      const response = await openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for older adults asking questions about medications. Keep answers brief (3-5 sentences) and easy to understand.',
          },
          {
            role: 'user',
            content: query.trim(),
          },
        ],
        model: 'gpt-3.5-turbo',
      });

      const answer = response.choices?.[0]?.message?.content?.trim();
      Alert.alert('AI Response', answer || 'No response returned.');
    } catch (err) {
      Alert.alert('Error', 'Failed to get response from AI.');
    } finally {
      setQueryModalVisible(false);
      setQuery('');
    }
  };

  const deleteMedication = async (id) => {
    Alert.alert('Delete Medication', 'Are you sure you want to delete this medication?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const db = getDBConnection();
            await db.runAsync('DELETE FROM medications WHERE id = ?', [id]);
            loadMedicationsAndLogs();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete medication.');
          }
        },
      },
    ]);
  };

  const scheduleNotification = async (schedule, selectedDays) => {
  const triggerTime = new Date(schedule); // Use the selected date and time
  const triggerDays = [];

  // Loop through the selected days and add them to the trigger
  for (let i = 0; i < 7; i++) {
    if (selectedDays[i]) {
      const dayOffset = (i - triggerTime.getDay() + 7) % 7; // Calculate the day offset
      const reminderDate = new Date(triggerTime);
      reminderDate.setDate(triggerTime.getDate() + dayOffset); // Correct day calculation
      reminderDate.setHours(triggerTime.getHours()); // Set the hour of the day
      reminderDate.setMinutes(triggerTime.getMinutes()); // Set the minutes

      if (reminderDate > new Date()) { // Only schedule if the date is in the future
        triggerDays.push({
          hour: reminderDate.getHours(),
          minute: reminderDate.getMinutes(),
          repeats: true, // Repeat the reminder
          weekday: reminderDate.getDay(), // Set weekday for recurring reminders
        });
      }
    }
  }

  if (triggerDays.length > 0) {
    triggerDays.forEach(async (trigger) => {
      console.log('Scheduled reminder for:', trigger); // Debugging line
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to take your medication',
          body: `Don't forget to take your medication!`,
        },
        trigger: {
          hour: trigger.hour,
          minute: trigger.minute,
          weekday: trigger.weekday, // Repeat on the selected weekday
          repeats: true,
        },
      });
    });
  }
};

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || form.schedule;
    setShowDatePicker(false);
    setForm({ ...form, schedule: currentDate });
  };

  const toggleDay = (index) => {
    const updatedDays = [...form.selectedDays];
    updatedDays[index] = !updatedDays[index];
    setForm({ ...form, selectedDays: updatedDays });
  };

  // Define checkTodayStatus function
  
  const loadDoseHistory = async () => {
    try {
      const db = getDBConnection();
      const result = await db.getAllAsync(`
        SELECT medications.name, medication_logs.date, medication_logs.taken
        FROM medication_logs
        JOIN medications ON medication_logs.medication_id = medications.id
        ORDER BY medication_logs.date DESC
      `);
      const grouped = {};
      result.forEach(entry => {
        if (!grouped[entry.date]) grouped[entry.date] = [];
        grouped[entry.date].push({
          name: entry.name,
          taken: entry.taken === 1
        });
      });
      setDoseHistory(grouped);
      setHistoryModalVisible(true);
    } catch (err) {
      Alert.alert("Error", "Failed to load dose history.");
    }
  };

  
  const markAsTaken = async (medicationId) => {
    try {
      const db = getDBConnection();
      const today = new Date().toISOString().split("T")[0];
  
      // Check if already taken today
      const result = await db.getAllAsync(
        "SELECT * FROM medication_logs WHERE medication_id = ? AND date = ? AND taken = 1",
        [medicationId, today]
      );
  
      if (result.length > 0) {
        Alert.alert(
          "⚠️ Already Taken",
          "You've already marked this medication as taken today. Taking it again could be dangerous."
        );
        return;
      }
  
      // Otherwise, log it
      await db.runAsync(
        "INSERT INTO medication_logs (medication_id, date, taken) VALUES (?, ?, 1)",
        [medicationId, today]
      );
      loadMedicationsAndLogs(); // refresh logs
    } catch (err) {
      Alert.alert("Error", "Failed to mark medication as taken.");
    }
  };
  

  const checkTodayStatus = () => {
    const total = medications.length;
    const taken = Object.values(logs).filter(Boolean).length;

    if (total === 0) {
      Alert.alert('No Medications', 'You have not added any medications yet.');
    } else if (taken === total) {
      Alert.alert('✅ All Done', `You’ve taken all ${total} medications today.`);
    } else {
      Alert.alert('⚠️ Incomplete', `Taken ${taken} of ${total}. Don’t forget the rest!`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text style={styles.header}>Your Medications</Text>

      <TouchableOpacity style={styles.statusButton} onPress={checkTodayStatus}>
        <Text style={styles.statusButtonText}>📋 Check Today’s Status</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.askButton} onPress={() => setQueryModalVisible(true)}>
        <Text style={styles.askButtonText}>💬 Ask a Medication Question</Text>
      </TouchableOpacity>

      <Modal visible={queryModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter your question"
              value={query}
              onChangeText={setQuery}
            />
            <TouchableOpacity style={styles.modalButton} onPress={handleAskQuestion}>
              <Text style={styles.modalButtonText}>Ask Question</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButton} onPress={() => setQueryModalVisible(false)}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <TextInput
              style={styles.input}
              placeholder="Medication Name"
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Dosage"
              value={form.dosage}
              onChangeText={(text) => setForm({ ...form, dosage: text })}
            />
            <TouchableOpacity style={styles.button} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.buttonText}>Pick Time for Reminder</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Side Effects (optional)"
              value={form.side_effects}
              onChangeText={(text) => setForm({ ...form, side_effects: text })}
            />

            <Text style={styles.subHeader}>Select Days for Reminder:</Text>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
              <View key={index} style={styles.checkboxContainer}>
                <Text>{day}</Text>
                <Switch
                  value={form.selectedDays[index]}
                  onValueChange={() => toggleDay(index)}
                />
              </View>
            ))}

            <TouchableOpacity style={styles.modalButton} onPress={handleAddMedication}>
              <Text style={styles.modalButtonText}>Add Medication</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DateTimePicker modal */}
      <Modal visible={showDatePicker} animationType="slide" transparent={true}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <DateTimePicker
              value={form.schedule}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={handleDateChange}
            />
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {medications.length > 0 ? (
        medications.map((item) => (
          <View key={item.id} style={[styles.card, { borderLeftColor: item.color || '#999' }]}>
            <Text style={styles.name}>{item.icon || '💊'} {item.name}</Text>
            <Text style={styles.details}>Dosage: {item.dosage}</Text>
            <Text style={styles.details}>Schedule: {item.schedule}</Text>
            <Text style={styles.details}>Side Effects: {item.side_effects || 'None listed'}</Text>

            <TouchableOpacity style={styles.readButton} onPress={() => speakMedicationInfo(item)}>
              <Text style={styles.readButtonText}>🔊 Read Aloud</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.takenButton, logs[item.id] && styles.takenButtonDisabled]}
              onPress={() => markAsTaken(item.id)}
              disabled={logs[item.id]}
            >
              <Text style={styles.takenButtonText}>
                {logs[item.id] ? '✅ Taken Today' : '✅ Mark as Taken'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteMedication(item.id)}>
              <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>No medications added.</Text>
      )}

      
      <TouchableOpacity style={styles.button} onPress={loadDoseHistory}>
        <Text style={styles.buttonText}>📅 View Dose History</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
        <Text style={styles.buttonText}>+ Add Medication</Text>
      </TouchableOpacity>
    
      <Modal visible={historyModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.header}>Dose History</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {Object.keys(doseHistory).map((date) => (
                <View key={date} style={{ marginBottom: 10 }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>{`📅 ${date}`}</Text>
                  {doseHistory[date].map((entry, index) => (
                    <Text key={index}>
                      {entry.taken ? '✔️' : '✘'} {entry.name}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalButton} onPress={() => setHistoryModalVisible(false)}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: { padding: 20 },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  subHeader: { fontSize: 16, marginTop: 10 },
  empty: { textAlign: 'center', marginTop: 20, color: '#666' },
  card: { borderLeftWidth: 5, backgroundColor: '#fff', padding: 15, marginVertical: 5, borderRadius: 8, elevation: 2 },
  name: { fontSize: 18, fontWeight: '600' },
  details: { fontSize: 14, color: '#444' },
  readButton: { marginTop: 10, backgroundColor: '#6200ee', padding: 8, borderRadius: 6, alignItems: 'center' },
  readButtonText: { color: '#fff', fontWeight: 'bold' },
  takenButton: { marginTop: 8, backgroundColor: '#388e3c', padding: 8, borderRadius: 6, alignItems: 'center' },
  takenButtonDisabled: { backgroundColor: '#bbb' },
  takenButtonText: { color: '#fff', fontWeight: 'bold' },
  deleteButton: { marginTop: 8, backgroundColor: '#e53935', padding: 8, borderRadius: 6, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontWeight: 'bold' },
  statusButton: { backgroundColor: '#ff9800', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  statusButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  askButton: { backgroundColor: '#3f51b5', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  askButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  button: { marginTop: 20, backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalBackground: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContainer: { backgroundColor: 'white', padding: 20, borderRadius: 8, width: '80%' },
  input: { borderBottomWidth: 1, marginBottom: 10, padding: 8 },
  modalButton: { backgroundColor: '#6200ee', padding: 10, borderRadius: 6, marginBottom: 10, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontWeight: 'bold' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
});

export default MedicationList;

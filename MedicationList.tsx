import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import * as Speech from 'expo-speech';
import { getDBConnection } from './db/database';
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
    schedule: '',
    side_effects: '',
    icon: '💊',
    color: '#81d4fa',
  });

  useEffect(() => {
    loadMedicationsAndLogs();
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
    } catch (error) {
      Alert.alert('Database Error', 'Unable to fetch medications or logs.');
    }
  };

  const handleAddMedication = async () => {
    const { name, dosage, schedule } = form;
    if (!name || !dosage || !schedule) {
      Alert.alert('Validation Error', 'Name, dosage, and schedule are required.');
      return;
    }

    try {
      const db = getDBConnection();
      await db.runAsync(
        `INSERT INTO medications (name, dosage, schedule, side_effects, icon, color)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [form.name, form.dosage, form.schedule, form.side_effects, form.icon, form.color]
      );
      setForm({
        name: '',
        dosage: '',
        schedule: '',
        side_effects: '',
        icon: '💊',
        color: '#81d4fa',
      });
      setModalVisible(false);
      loadMedicationsAndLogs();
    } catch (error) {
      Alert.alert('Error', 'Failed to save medication.');
    }
  };

  const speakMedicationInfo = (med) => {
    const info = `${med.icon} ${med.name}. Dosage: ${med.dosage}. Schedule: ${med.schedule}. Side effects: ${med.side_effects || 'None listed.'}`;
    Speech.speak(info, { rate: 0.9 });
  };

  const markAsTaken = async (medicationId) => {
    const today = getTodayDate();
    if (logs[medicationId]) {
      Alert.alert('⚠️ Already Taken', 'You already marked this today.');
      return;
    }

    try {
      const db = getDBConnection();
      await db.runAsync(
        'INSERT INTO medication_logs (medication_id, date, taken) VALUES (?, ?, ?)',
        [medicationId, today, 1]
      );
      Alert.alert('✅ Dose Logged', 'Medication marked as taken.');
      loadMedicationsAndLogs();
    } catch {
      Alert.alert('Error', 'Failed to log medication.');
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
      console.error(err);
      Alert.alert('Error', 'Failed to get response from AI.');
    } finally {
      setQueryModalVisible(false);
      setQuery('');
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

      {medications.length > 0 ? (
        medications.map((item) => (
          <View key={item.id} style={[styles.card, { borderLeftColor: item.color || '#999' }]}>
            <Text style={styles.name}>{item.icon || '💊'} {item.name}</Text>
            <Text style={styles.details}>Dosage: {item.dosage}</Text>
            <Text style={styles.details}>Schedule: {item.schedule}</Text>

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

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteMedication(item.id)}
            >
              <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>No medications added.</Text>
      )}

      <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
        <Text style={styles.buttonText}>+ Add Medication</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: { padding: 20 },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
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
});

export default MedicationList;
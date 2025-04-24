import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { getDBConnection } from './db/database';

const MedicationList = () => {
  const [medications, setMedications] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({
    name: '',
    dosage: '',
    schedule: '',
    side_effects: '',
    icon: '💊',
    color: '#81d4fa',
  });

  useEffect(() => {
    loadMedications();
  }, []);

  const loadMedications = async () => {
    try {
      const db = getDBConnection();
      const results = await db.getAllAsync('SELECT * FROM medications');
      setMedications(results);
    } catch (error) {
      console.error("❌ Failed to load medications:", error);
      Alert.alert('Database Error', 'Unable to fetch medications.');
    }
  };

  const handleAddMedication = async () => {
    const { name, dosage, schedule } = form;
    if (!name || !dosage || !schedule) {
      Alert.alert("Validation Error", "Name, dosage, and schedule are required.");
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
      loadMedications();
    } catch (error) {
      console.error("❌ Insert failed:", error);
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.card, { borderLeftColor: item.color || '#999' }]}>
      <Text style={styles.name}>{item.icon || '💊'} {item.name}</Text>
      <Text style={styles.details}>Dosage: {item.dosage}</Text>
      <Text style={styles.details}>Schedule: {item.schedule}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Medications</Text>

      <FlatList
        data={medications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No medications added.</Text>}
      />

      <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
        <Text style={styles.buttonText}>+ Add Medication</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Medication</Text>

            <TextInput
              placeholder="Name"
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
              style={styles.input}
            />
            <TextInput
              placeholder="Dosage"
              value={form.dosage}
              onChangeText={(text) => setForm({ ...form, dosage: text })}
              style={styles.input}
            />
            <TextInput
              placeholder="Schedule (e.g. 8:00 AM)"
              value={form.schedule}
              onChangeText={(text) => setForm({ ...form, schedule: text })}
              style={styles.input}
            />
            <TextInput
              placeholder="Side Effects (optional)"
              value={form.side_effects}
              onChangeText={(text) => setForm({ ...form, side_effects: text })}
              style={styles.input}
            />
            <TextInput
              placeholder="Icon (e.g. 💊)"
              value={form.icon}
              onChangeText={(text) => setForm({ ...form, icon: text })}
              style={styles.input}
            />
            <TextInput
              placeholder="Color (e.g. #81d4fa)"
              value={form.color}
              onChangeText={(text) => setForm({ ...form, color: text })}
              style={styles.input}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={handleAddMedication}>
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#aaa' }]} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  empty: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  card: {
    borderLeftWidth: 5,
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    elevation: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  details: {
    fontSize: 14,
    color: '#444',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 6,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default MedicationList;

import { WoWDBCFile } from 'wow-dbcfile-node';
import { unlink } from 'fs/promises';

const fieldDefinitions = {
  id: 'uint32',
  name: 'string',
  description: 'string',
  value: 'float',
};

async function runDemo() {
  const testFile = 'test.dbc';

  try {
    // Create a new DBC file
    const dbc = new WoWDBCFile(testFile, fieldDefinitions);

    // Add some test data
    const testRecords = [
      { id: 1, name: 'Item1', description: 'First item', value: 10.5 },
      { id: 2, name: 'Item2', description: 'Second item', value: 20.75 },
      { id: 3, name: 'Item3', description: 'Third item', value: 30.25 },
    ];

    testRecords.forEach(record => dbc.createRecordWithValues(record));

    // Write the DBC file
    dbc.write();

    console.log('DBC file created and written successfully.');

    // Read the DBC file
    const readDbc = new WoWDBCFile(testFile, fieldDefinitions);
    readDbc.read();

    console.log('DBC file read successfully. Contents:');
    for (let i = 0; i < readDbc.header.record_count; i++) {
      console.log(readDbc.getRecord(i));
    }

    // Perform a search
    const searchResults = readDbc.findBy('name', 'Item2');
    console.log('Search results for name "Item2":', searchResults);

    // Update a record
    readDbc.updateRecord(1, 'value', 25.0);
    console.log('Updated record:', readDbc.getRecord(1));

    // Clean up
    await unlink(testFile);
    console.log('Test file cleaned up.');

    console.log('Demo completed successfully!');
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

runDemo();
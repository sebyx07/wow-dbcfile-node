import { expect } from 'chai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { WoWDBCFile } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('WoWDBCFile', function() {
  const originalFile = path.join(__dirname, 'resources', 'Item.dbc');
  const testFile = path.join(__dirname, 'resources', 'Item_test.dbc');
  const newFile = path.join(__dirname, 'resources', 'Item_new.dbc');
  const fieldDefinitions = {
    id: 'uint32',
    class: 'uint32',
    subclass: 'uint32',
    sound_override_subclass: 'int32',
    material: 'uint32',
    displayid: 'uint32',
    inventory_type: 'uint32',
    sheath_type: 'uint32'
  };

  let dbcFile;

  beforeEach(async function() {
    await fs.copyFile(originalFile, testFile);
    dbcFile = new WoWDBCFile(testFile, fieldDefinitions);
    dbcFile.read();
  });

  afterEach(async function() {
    try {
      await fs.unlink(testFile);
      await fs.unlink(newFile);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  });

  describe('CRUD operations', function() {
    it('reads the DBC file correctly', function() {
      expect(dbcFile).to.be.an.instanceOf(WoWDBCFile);
      expect(dbcFile.filepath).to.equal(testFile);
    });

    it('creates a new record', function() {
      const initialCount = dbcFile.header.record_count;
      const newRecordIndex = dbcFile.createRecord();
      expect(dbcFile.header.record_count).to.equal(initialCount + 1);
      expect(newRecordIndex).to.equal(initialCount);
    });

    it('reads a record', function() {
      const record = dbcFile.getRecord(0);
      expect(record).to.be.an('object');
      expect(Object.keys(record)).to.have.members(Object.keys(fieldDefinitions));
    });

    it('updates a record', function() {
      const originalValue = dbcFile.getRecord(0).class;
      const newValue = originalValue + 1;
      dbcFile.updateRecord(0, 'class', newValue);
      const updatedRecord = dbcFile.getRecord(0);
      expect(updatedRecord.class).to.equal(newValue);
    });

    it('deletes a record', function() {
      const initialCount = dbcFile.header.record_count;
      dbcFile.deleteRecord(initialCount - 1);
      expect(dbcFile.header.record_count).to.equal(initialCount - 1);
    });

    it('writes changes to the file', async function() {
      const newValue = 99999;
      dbcFile.updateRecord(0, 'class', newValue);
      await dbcFile.write();

      // Read the file again to verify changes
      const newDbcFile = new WoWDBCFile(testFile, fieldDefinitions);
      newDbcFile.read();
      expect(newDbcFile.getRecord(0).class).to.equal(newValue);
    });

    it('creates a new record with initial values', function() {
      const initialValues = {
        id: 1000,
        class: 2,
        subclass: 3,
        sound_override_subclass: -1,
        material: 4,
        displayid: 5,
        inventory_type: 6,
        sheath_type: 7
      };
      const newRecordIndex = dbcFile.createRecordWithValues(initialValues);
      const newRecord = dbcFile.getRecord(newRecordIndex);

      Object.entries(initialValues).forEach(([key, value]) => {
        expect(newRecord[key]).to.equal(value);
      });
    });

    it('updates multiple fields of a record at once', function() {
      const originalRecord = dbcFile.getRecord(0);
      const updates = { class: 5, subclass: 6, material: 7 };
      dbcFile.updateRecordMulti(0, updates);
      const updatedRecord = dbcFile.getRecord(0);

      expect(updatedRecord.class).to.equal(5);
      expect(updatedRecord.subclass).to.equal(6);
      expect(updatedRecord.material).to.equal(7);
      expect(updatedRecord.id).to.equal(originalRecord.id);  // Ensure other fields remain unchanged
    });

    it('creates a record with initial values and then updates multiple fields', function() {
      const initialValues = {
        id: 2000,
        class: 3,
        subclass: 4,
        sound_override_subclass: -1,
        material: 5,
        displayid: 6,
        inventory_type: 7,
        sheath_type: 8
      };
      const newRecordIndex = dbcFile.createRecordWithValues(initialValues);

      const updates = { class: 8, material: 9, inventory_type: 10 };
      dbcFile.updateRecordMulti(newRecordIndex, updates);

      const updatedRecord = dbcFile.getRecord(newRecordIndex);

      expect(updatedRecord.id).to.equal(2000);
      expect(updatedRecord.class).to.equal(8);
      expect(updatedRecord.subclass).to.equal(4);
      expect(updatedRecord.sound_override_subclass).to.equal(-1);
      expect(updatedRecord.material).to.equal(9);
      expect(updatedRecord.displayid).to.equal(6);
      expect(updatedRecord.inventory_type).to.equal(10);
      expect(updatedRecord.sheath_type).to.equal(8);
    });

    it('finds a record by id', function() {
      const results = dbcFile.findBy('id', 32837);
      expect(results).to.be.an('array');
      expect(results).to.have.lengthOf(1);
      expect(results[0].value.id).to.equal(32837);
    });

    it('returns an empty array when no matching records are found', function() {
      const results = dbcFile.findBy('id', 999999);  // Assuming this ID doesn't exist
      expect(results).to.be.an('array');
      expect(results).to.be.empty;
    });

    it('finds multiple records with the same value in a field', function() {
      // Assuming there are multiple records with class 2
      const results = dbcFile.findBy('class', 2);
      expect(results).to.be.an('array');
      expect(results.length).to.be.above(1);
      results.forEach(record => {
        expect(record.value.class).to.equal(2);
      });
    });
  });

  describe('#writeTo', function() {
    it('writes the DBC file to a new location', async function() {
      await dbcFile.writeTo(newFile);
      const fileExists = await fs.access(newFile).then(() => true).catch(() => false);
      expect(fileExists).to.be.true;
    });

    it('preserves the original file', async function() {
      const originalContent = await fs.readFile(testFile);
      await dbcFile.writeTo(newFile);
      const testFileContent = await fs.readFile(testFile);
      expect(testFileContent).to.deep.equal(originalContent);
    });

    it('writes a file with the same content as the original', async function() {
      await dbcFile.writeTo(newFile);
      const [testFileContent, newFileContent] = await Promise.all([
        fs.readFile(testFile),
        fs.readFile(newFile)
      ]);
      expect(newFileContent).to.deep.equal(testFileContent);
    });

    it('writes changes to the new file', async function() {
      const newValue = 99999;
      dbcFile.updateRecord(0, 'class', newValue);
      await dbcFile.writeTo(newFile);

      const newDbcFile = new WoWDBCFile(newFile, fieldDefinitions);
      newDbcFile.read();
      expect(newDbcFile.getRecord(0).class).to.equal(newValue);

      const originalDbcFile = new WoWDBCFile(testFile, fieldDefinitions);
      originalDbcFile.read();
      expect(originalDbcFile.getRecord(0).class).to.not.equal(newValue);
    });

    it('raises an error when the new file path is invalid', async function() {
      const invalidPath = '/invalid/path/file.dbc';
      try {
        await dbcFile.writeTo(invalidPath);
        expect.fail('Expected method to throw an error');
      } catch (error) {
        expect(error.message).to.equal('Invalid file path or permission denied');
      }
    });

    it('overwrites an existing file at the new path', async function() {
      const originalContent = 'Original content';
      await fs.writeFile(newFile, originalContent);

      await dbcFile.writeTo(newFile);

      const [newFileContent, testFileContent] = await Promise.all([
        fs.readFile(newFile),
        fs.readFile(testFile)
      ]);
      expect(newFileContent).to.not.equal(originalContent);
      expect(newFileContent).to.deep.equal(testFileContent);
    });
  });

  describe('error handling', function() {
    it('raises an error when trying to get a non-existent record', function() {
      expect(() => dbcFile.getRecord(-1)).to.throw(Error);
      expect(() => dbcFile.getRecord(999999)).to.throw(Error);
    });

    it('raises an error when trying to update a non-existent record', function() {
      expect(() => dbcFile.updateRecord(-1, 'id', 0)).to.throw(Error);
      expect(() => dbcFile.updateRecord(999999, 'id', 0)).to.throw(Error);
    });

    it('raises an error when trying to update a non-existent field', function() {
      expect(() => dbcFile.updateRecord(0, 'non_existent_field', 0)).to.throw(Error);
    });

    it('raises an error when trying to delete a non-existent record', function() {
      expect(() => dbcFile.deleteRecord(-1)).to.throw(Error);
      expect(() => dbcFile.deleteRecord(999999)).to.throw(Error);
    });

    it('raises an error when trying to create a record with invalid field names', function() {
      const invalidValues = { id: 3000, invalid_field: 5 };
      expect(() => dbcFile.createRecordWithValues(invalidValues)).to.throw(Error);
    });

    it('raises an error when trying to update multiple fields with invalid field names', function() {
      const invalidUpdates = { class: 7, invalid_field: 8 };
      expect(() => dbcFile.updateRecordMulti(0, invalidUpdates)).to.throw(Error);
    });

    it('raises an error when trying to update multiple fields of a non-existent record', function() {
      const updates = { class: 9, subclass: 10 };
      expect(() => dbcFile.updateRecordMulti(-1, updates)).to.throw(Error);
      expect(() => dbcFile.updateRecordMulti(999999, updates)).to.throw(Error);
    });
  });
});
import bindings from 'bindings';
import fs from 'fs/promises';
import path from 'path';
const { DBCFile } = bindings('dbcfile');

class WoWDBCFile {
  constructor(filepath, fieldDefinitions) {
    this.#validateFieldDefinitions(fieldDefinitions);
    this.dbc = new DBCFile(filepath, fieldDefinitions);
    this.fieldList = Object.keys(fieldDefinitions);
  }

  get filepath() {
    return this.dbc.getFilePath();
  }

  read() {
    return this.dbc.read();
  }

  write() {
    return this.dbc.write();
  }

  async writeTo(filepath) {
    await this.#validatePath(filepath);
    try {
      await this.dbc.writeTo(filepath);
    } catch (error) {
      if (error.message.includes('Invalid file path or permission denied')) {
        throw new Error('Invalid file path or permission denied');
      }
      throw error;
    }
  }

  createRecord(values = {}) {
    this.#validateFields(Object.keys(values));
    return this.dbc.createRecord(values);
  }

  createRecordWithValues(values) {
    this.#validateFields(Object.keys(values));
    return this.dbc.createRecordWithValues(values);
  }

  updateRecord(index, field, value) {
    this.#validateFields([field]);
    const updates = {};
    updates[field] = value;
    return this.dbc.updateRecord(index, field, updates);
  }

  updateRecordMulti(index, updates) {
    this.#validateFields(Object.keys(updates));
    for (const [field, value] of Object.entries(updates)) {
      this.updateRecord(index, field, value);
    }
  }

  getRecord(index) {
    return this.dbc.getRecord(index);
  }

  deleteRecord(index) {
    return this.dbc.deleteRecord(index);
  }

  findBy(field, value) {
    this.#validateFields([field]);
    return this.dbc.findBy(field, value);
  }

  get header() {
    return this.dbc.getHeader();
  }

  #validateFieldDefinitions(fieldDefinitions) {
    if (!fieldDefinitions || typeof fieldDefinitions !== 'object') {
      throw new Error('Field definitions must be an Object');
    }

    if (Object.keys(fieldDefinitions).length === 0) {
      throw new Error('Field definitions must have at least one field');
    }
  }

  #validateFields(fields) {
    for (const field of fields) {
      if (!this.fieldList.includes(field)) {
        throw new Error(`Invalid field: ${field}`);
      }
    }
  }

  async #validatePath(filepath) {
    if (!filepath || typeof filepath !== 'string') {
      throw new Error('Invalid file path');
    }

    const dirName = path.dirname(filepath);
    try {
      await fs.access(dirName);
    } catch {
      throw new Error('Invalid file path or permission denied');
    }
  }
}

export { WoWDBCFile };
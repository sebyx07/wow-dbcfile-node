import bindings from 'bindings';
const { DBCFile } = bindings('dbcfile');

class WoWDBCFile {
  constructor(filepath, fieldDefinitions) {
    this.dbc = new DBCFile(filepath, fieldDefinitions);
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

  writeTo(filepath) {
    return this.dbc.writeTo(filepath);
  }

  createRecord(values = {}) {
    return this.dbc.createRecord(values);
  }

  createRecordWithValues(values) {
    return this.createRecord(values);
  }

  updateRecord(index, field, value) {
    const updates = {};
    updates[field] = value;
    return this.dbc.updateRecord(index, field, updates);
  }

  updateRecordMulti(index, updates) {
    for (const [field, value] of Object.entries(updates)) {
      this.updateRecord(index, field, value);
    }
  }

  getRecord(index) {
    return this.dbc.getRecord(index);
  }

  findBy(field, value) {
    return this.dbc.findBy(field, value);
  }

  get header() {
    return this.dbc.getHeader();
  }
}

export { WoWDBCFile };
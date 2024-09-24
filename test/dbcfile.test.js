import { expect } from 'chai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { WoWDBCFile } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('WoWDBCFile', function() {
  const testFile = path.join(__dirname, 'resources', 'ItemDisplayInfo.dbc');
  const fieldDefinitions = {
    id: 'uint32',
    model_name_1: 'string',
    model_name_2: 'string',
    model_texture_1: 'string',
    model_texture_2: 'string',
    inventory_icon_1: 'string',
    inventory_icon_2: 'string',
    geoset_group_1: 'uint32',
    geoset_group_2: 'uint32',
    geoset_group_3: 'uint32',
    flags: 'uint32',
    spell_visual_id: 'uint32',
    group_sound_index: 'uint32',
    helmet_geoset_vis_id_1: 'uint32',
    helmet_geoset_vis_id_2: 'uint32',
    texture_1: 'string',
    texture_2: 'string',
    texture_3: 'string',
    texture_4: 'string',
    texture_5: 'string',
    texture_6: 'string',
    texture_7: 'string',
    texture_8: 'string',
    item_visual: 'uint32',
    particle_color_id: 'uint32'
  };

  let dbcFile;

  beforeEach(function() {
    dbcFile = new WoWDBCFile(testFile, fieldDefinitions);
    dbcFile.read();
  });

  describe('basic operations', function() {
    it('reads the DBC file correctly', function() {
      expect(dbcFile).to.be.an.instanceOf(WoWDBCFile);
      expect(dbcFile.filepath).to.equal(testFile);
    });

    it('returns correct header information', function() {
      const header = dbcFile.header;
      expect(header.record_count).to.be.above(0);
      expect(header.field_count).to.equal(Object.keys(fieldDefinitions).length);
    });
  });

  describe('string operations', function() {
    let firstRecord;

    beforeEach(function() {
      firstRecord = dbcFile.getRecord(0);
    });

    it('reads string fields correctly', function() {
      expect(firstRecord.model_name_1).to.be.a('string');
      expect(firstRecord.model_texture_1).to.be.a('string');
      expect(firstRecord.inventory_icon_1).to.be.a('string');
    });

    it('updates string fields', function() {
      const newModelName = "NewModelName";
      dbcFile.updateRecord(0, 'model_name_1', newModelName);
      const updatedRecord = dbcFile.getRecord(0);
      expect(updatedRecord.model_name_1).to.equal(newModelName);
    });

    it('handles empty strings', function() {
      const emptyStringRecordIndex = dbcFile.createRecordWithValues({
        id: 99999,
        model_name_1: "",
        model_name_2: "",
        inventory_icon_1: ""
      });
      const record = dbcFile.getRecord(emptyStringRecordIndex);
      expect(record.model_name_1).to.equal("");
      expect(record.model_name_2).to.equal("");
      expect(record.inventory_icon_1).to.equal("");
    });
  });

  describe('search operations', function() {
    it('finds records by string field', function() {
      const sampleModelName = dbcFile.getRecord(0).model_name_1;
      const results = dbcFile.findBy('model_name_1', sampleModelName);
      expect(results).to.not.be.empty;
      expect(results[0].model_name_1).to.equal(sampleModelName);
    });
  });

  describe('write operations', function() {
    const newFile = path.join(__dirname, 'resources', 'ItemDisplayInfo_new.dbc');

    afterEach(async function() {
      try {
        await fs.unlink(newFile);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    });

    it('writes changes to a new file', async function() {
      const newModelName = "NewModelName";
      dbcFile.updateRecord(0, 'model_name_1', newModelName);
      await dbcFile.writeTo(newFile);

      const newDbcFile = new WoWDBCFile(newFile, fieldDefinitions);
      newDbcFile.read();
      expect(newDbcFile.getRecord(0).model_name_1).to.equal(newModelName);
    });
  });
});
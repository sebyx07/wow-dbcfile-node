# WoWDBC-Node 🎮

WoWDBC-Node is a high-performance Node.js package for reading and manipulating World of Warcraft DBC (Database Client) files. 🚀

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [API](#-api)
- [Development](#-development)
- [Testing](#-testing)
- [Contributing](#-contributing)
- [License](#-license)

## 🌟 Features

- Fast reading and writing of DBC files
- CRUD operations for DBC records
- Node.js-friendly interface with field name access
- Efficient C++ addon for optimal performance

## 💻 Installation

Install the package using npm:

```bash
npm install wowdbc-node
```

Or using yarn:

```bash
yarn add wowdbc-node
```

## 📚 Usage

Here's a quick example of how to use WoWDBC-Node:

```javascript
import { WoWDBCFile } from 'wow-dbcfile-node';

// Correct field definitions for the Item.dbc file
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

// Open the Item.dbc file
const dbc = new WoWDBCFile('path/to/your/Item.dbc', fieldDefinitions);
dbc.read();

// Find a specific item (e.g., Warglaive of Azzinoth, ID: 32837)
const warglaive = dbc.findBy('id', 32837)[0];
console.log("Warglaive of Azzinoth:", warglaive);

// Update a single field of the Warglaive
dbc.updateRecord(warglaive.id, 'sheath_type', 3);  // Assuming 3 represents a different sheath type

// Update multiple fields of the Warglaive
dbc.updateRecordMulti(warglaive.id, { material: 5, inventory_type: 17 });  // Assuming 5 is a different material and 17 is Two-Hand

// Create a new empty item record
const newItemIndex = dbc.createRecord();
console.log("New empty item index:", newItemIndex);

// Create a new item record with initial values
const initialValues = {
  id: 99999,
  class: 2,  // Weapon
  subclass: 7,  // Warglaives
  sound_override_subclass: -1,  // No override
  material: warglaive.material,
  displayid: warglaive.displayid,
  inventory_type: 17,  // Two-Hand
  sheath_type: 3
};
const newItemIndexWithValues = dbc.createRecordWithValues(initialValues);
console.log("New custom item index:", newItemIndexWithValues);

// Read the newly created item
const newItem = dbc.getRecord(newItemIndexWithValues);
console.log("Newly created item:", newItem);

// Write changes back to the same file (update)
dbc.write();

// Write to a new file
dbc.writeTo('path/to/your/NewItem.dbc');

// Reading header information
const header = dbc.header;
console.log("Total items:", header.record_count);
console.log("Fields per item:", header.field_count);

// Finding all two-handed weapons
const twoHandedWeapons = dbc.findBy('inventory_type', 17);  // 17 represents Two-Hand weapons

console.log('Two-handed weapons:');
twoHandedWeapons.forEach(item => {
  const { value, index } = item;
  console.log(`Item ID: ${value.id}, Class: ${value.class}, Subclass: ${value.subclass}, Display ID: ${value.displayid}`);
});
```

## 📚 API

### `WoWDBCFile` class

#### Constructor: `new WoWDBCFile(filename, fieldDefinitions)`

- `filename`: Path to the DBC file
- `fieldDefinitions`: Object defining the structure of the DBC file

#### Methods

- `read()`: Read the DBC file
- `write()`: Write changes back to the original file
- `writeTo(filename)`: Write to a new file
- `createRecord()`: Create a new empty record
- `createRecordWithValues(values)`: Create a new record with initial values
- `updateRecord(index, field, value)`: Update a single field of a record
- `updateRecordMulti(index, updates)`: Update multiple fields of a record
- `getRecord(index)`: Get a record by its index
- `findBy(field, value)`: Find records by field value
- `getHeader()`: Get the DBC file header information

## 🛠️ Development

To set up the project for development:

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/wowdbc-node.git
   cd wowdbc-node
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the Node.js addon:
   ```
   npm run build
   ```

## 🧪 Testing

To run the tests:

```
npm test
```

The tests use Mocha as the test runner and Chai for assertions.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- Inspired by the World of Warcraft modding community
- All contributors who have helped with code, bug reports, and suggestions

Happy coding, and may your adventures in Azeroth be bug-free! 🐉✨
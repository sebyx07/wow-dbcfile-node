#include <napi.h>
#include <fstream>
#include <vector>
#include <unordered_map>
#include <cstring>

enum class FieldType {
    TYPE_UINT32,
    TYPE_INT32,
    TYPE_FLOAT,
    TYPE_STRING
};

struct FieldValue {
    FieldType type;
    union {
        uint32_t uint32_value;
        int32_t int32_value;
        float float_value;
        uint32_t string_offset;
    } value;
};

struct DBCHeader {
    char magic[4];
    uint32_t record_count;
    uint32_t field_count;
    uint32_t record_size;
    uint32_t string_block_size;
};

class DBCFile : public Napi::ObjectWrap<DBCFile> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    DBCFile(const Napi::CallbackInfo& info);

private:
    static Napi::FunctionReference constructor;

    Napi::Value Read(const Napi::CallbackInfo& info);
    Napi::Value Write(const Napi::CallbackInfo& info);
    Napi::Value WriteTo(const Napi::CallbackInfo& info);
    Napi::Value CreateRecord(const Napi::CallbackInfo& info);
    Napi::Value UpdateRecord(const Napi::CallbackInfo& info);
    Napi::Value GetRecord(const Napi::CallbackInfo& info);
    Napi::Value GetHeader(const Napi::CallbackInfo& info);
    Napi::Value FindBy(const Napi::CallbackInfo& info);
    Napi::Value GetFilePath(const Napi::CallbackInfo& info);
    Napi::Value DeleteRecord(const Napi::CallbackInfo& info);
    Napi::Value CreateRecordWithValues(const Napi::CallbackInfo& info);

    FieldType StringToFieldType(const std::string& type_str);
    Napi::Value FieldValueToNapi(Napi::Env env, const FieldValue& value);
    FieldValue NapiToFieldValue(const Napi::Value& value, FieldType type);

    std::string filepath;
    DBCHeader header;
    std::vector<std::vector<FieldValue>> records;
    std::string string_block;
    std::vector<std::pair<std::string, FieldType>> field_definitions;
};

Napi::FunctionReference DBCFile::constructor;

Napi::Object DBCFile::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);

    Napi::Function func = DefineClass(env, "DBCFile", {
        InstanceMethod("read", &DBCFile::Read),
        InstanceMethod("write", &DBCFile::Write),
        InstanceMethod("writeTo", &DBCFile::WriteTo),
        InstanceMethod("createRecord", &DBCFile::CreateRecord),
        InstanceMethod("updateRecord", &DBCFile::UpdateRecord),
        InstanceMethod("getRecord", &DBCFile::GetRecord),
        InstanceMethod("getHeader", &DBCFile::GetHeader),
        InstanceMethod("findBy", &DBCFile::FindBy),
        InstanceMethod("getFilePath", &DBCFile::GetFilePath),
        InstanceMethod("deleteRecord", &DBCFile::DeleteRecord),
        InstanceMethod("createRecordWithValues", &DBCFile::CreateRecordWithValues),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();
    exports.Set("DBCFile", func);
    return exports;
}

DBCFile::DBCFile(const Napi::CallbackInfo& info) : Napi::ObjectWrap<DBCFile>(info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsObject()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return;
    }

    this->filepath = info[0].As<Napi::String>().Utf8Value();
    Napi::Object field_defs = info[1].As<Napi::Object>();

    Napi::Array keys = field_defs.GetPropertyNames();
    for (uint32_t i = 0; i < keys.Length(); i++) {
        Napi::Value key = keys[i];
        std::string field_name = key.As<Napi::String>().Utf8Value();
        std::string field_type = field_defs.Get(key).As<Napi::String>().Utf8Value();
        this->field_definitions.push_back({field_name, StringToFieldType(field_type)});
    }

    // Initialize header
    std::memcpy(this->header.magic, "WDBC", 4);
    this->header.record_count = 0;
    this->header.field_count = this->field_definitions.size();
    this->header.record_size = this->field_definitions.size() * sizeof(uint32_t);
    this->header.string_block_size = 1; // Start with an empty string (null terminator)
}

FieldType DBCFile::StringToFieldType(const std::string& type_str) {
    if (type_str == "uint32") return FieldType::TYPE_UINT32;
    if (type_str == "int32") return FieldType::TYPE_INT32;
    if (type_str == "float") return FieldType::TYPE_FLOAT;
    if (type_str == "string") return FieldType::TYPE_STRING;
    throw std::runtime_error("Invalid field type: " + type_str);
}

Napi::Value DBCFile::FieldValueToNapi(Napi::Env env, const FieldValue& value) {
    switch (value.type) {
        case FieldType::TYPE_UINT32:
            return Napi::Number::New(env, value.value.uint32_value);
        case FieldType::TYPE_INT32:
            return Napi::Number::New(env, value.value.int32_value);
        case FieldType::TYPE_FLOAT:
            return Napi::Number::New(env, value.value.float_value);
        case FieldType::TYPE_STRING:
            if (value.value.string_offset < this->string_block.size()) {
                return Napi::String::New(env, &this->string_block[value.value.string_offset]);
            } else {
                return Napi::String::New(env, "");
            }
    }
    return env.Null();
}

FieldValue DBCFile::NapiToFieldValue(const Napi::Value& value, FieldType type) {
    FieldValue field_value;
    field_value.type = type;

    switch (type) {
        case FieldType::TYPE_UINT32:
            field_value.value.uint32_value = value.IsNumber() ? value.As<Napi::Number>().Uint32Value() : 0;
            break;
        case FieldType::TYPE_INT32:
            field_value.value.int32_value = value.IsNumber() ? value.As<Napi::Number>().Int32Value() : 0;
            break;
        case FieldType::TYPE_FLOAT:
            field_value.value.float_value = value.IsNumber() ? value.As<Napi::Number>().FloatValue() : 0.0f;
            break;
        case FieldType::TYPE_STRING: {
            std::string str = value.IsString() ? value.As<Napi::String>().Utf8Value() : "";
            field_value.value.string_offset = this->string_block.size();
            this->string_block.append(str);
            this->string_block.push_back('\0');
            break;
        }
    }

    return field_value;
}

Napi::Value DBCFile::Read(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::ifstream file(this->filepath, std::ios::binary);
    if (!file) {
        Napi::Error::New(env, "Could not open file").ThrowAsJavaScriptException();
        return env.Null();
    }

    file.read(reinterpret_cast<char*>(&this->header), sizeof(DBCHeader));

    this->records.resize(this->header.record_count);
    for (uint32_t i = 0; i < this->header.record_count; i++) {
        this->records[i].resize(this->header.field_count);
        for (uint32_t j = 0; j < this->header.field_count; j++) {
            file.read(reinterpret_cast<char*>(&this->records[i][j].value), sizeof(uint32_t));
            this->records[i][j].type = this->field_definitions[j].second;
        }
    }

    this->string_block.resize(this->header.string_block_size);
    file.read(&this->string_block[0], this->header.string_block_size);

    file.close();

    return env.Undefined();
}

Napi::Value DBCFile::Write(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::ofstream file(this->filepath, std::ios::binary | std::ios::trunc);
    if (!file) {
        Napi::Error::New(env, "Could not open file for writing").ThrowAsJavaScriptException();
        return env.Null();
    }

    // Update header
    this->header.record_count = this->records.size();
    this->header.string_block_size = this->string_block.size();

    file.write(reinterpret_cast<char*>(&this->header), sizeof(DBCHeader));

    for (const auto& record : this->records) {
        for (const auto& field : record) {
            file.write(reinterpret_cast<const char*>(&field.value), sizeof(uint32_t));
        }
    }

    file.write(this->string_block.c_str(), this->string_block.size());

    file.close();

    return env.Undefined();
}

Napi::Value DBCFile::CreateRecord(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object values = info[0].As<Napi::Object>();
    std::vector<FieldValue> new_record;

    for (const auto& field_def : this->field_definitions) {
        FieldValue field_value;
        field_value.type = field_def.second;

        if (values.Has(field_def.first)) {
            Napi::Value value = values.Get(field_def.first);
            field_value = NapiToFieldValue(value, field_def.second);
        } else {
            // Set default value if the field is not provided
            switch (field_def.second) {
                case FieldType::TYPE_UINT32:
                case FieldType::TYPE_INT32:
                    field_value.value.uint32_value = 0;
                    break;
                case FieldType::TYPE_FLOAT:
                    field_value.value.float_value = 0.0f;
                    break;
                case FieldType::TYPE_STRING:
                    field_value.value.string_offset = this->string_block.size();
                    this->string_block.push_back('\0');
                    break;
            }
        }

        new_record.push_back(field_value);
    }

    this->records.push_back(new_record);
    this->header.record_count++;

    return Napi::Number::New(env, this->records.size() - 1);
}

Napi::Value DBCFile::UpdateRecord(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3 || !info[0].IsNumber() || !info[1].IsString() || !info[2].IsObject()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    uint32_t index = info[0].As<Napi::Number>().Uint32Value();
    std::string field_name = info[1].As<Napi::String>().Utf8Value();
    Napi::Object updates = info[2].As<Napi::Object>();

    if (index >= this->records.size()) {
        Napi::RangeError::New(env, "Invalid record index").ThrowAsJavaScriptException();
        return env.Null();
    }

    auto field_it = std::find_if(this->field_definitions.begin(), this->field_definitions.end(),
                                 [&field_name](const auto& pair) { return pair.first == field_name; });
    if (field_it == this->field_definitions.end()) {
        Napi::Error::New(env, "Invalid field name").ThrowAsJavaScriptException();
        return env.Null();
    }

    uint32_t field_index = std::distance(this->field_definitions.begin(), field_it);
    FieldValue new_value = NapiToFieldValue(updates.Get(field_name), field_it->second);

    // Update the string block if it's a string field
    if (field_it->second == FieldType::TYPE_STRING) {
        std::string new_string = updates.Get(field_name).As<Napi::String>().Utf8Value();
        uint32_t new_offset = this->string_block.size();
        this->string_block.append(new_string);
        this->string_block.push_back('\0');
        new_value.value.string_offset = new_offset;
    }

    this->records[index][field_index] = new_value;

    // Update header string block size
    this->header.string_block_size = this->string_block.size();

    return env.Undefined();
}

Napi::Value DBCFile::GetRecord(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    uint32_t index = info[0].As<Napi::Number>().Uint32Value();

    if (index >= this->records.size()) {
        Napi::RangeError::New(env, "Invalid record index").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object record = Napi::Object::New(env);
    for (size_t i = 0; i < this->field_definitions.size(); i++) {
        record.Set(this->field_definitions[i].first, FieldValueToNapi(env, this->records[index][i]));
    }

    return record;
}

Napi::Value DBCFile::GetHeader(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    Napi::Object header = Napi::Object::New(env);
    header.Set("magic", Napi::String::New(env, std::string(this->header.magic, 4)));
    header.Set("record_count", Napi::Number::New(env, this->header.record_count));
    header.Set("field_count", Napi::Number::New(env, this->header.field_count));
    header.Set("record_size", Napi::Number::New(env, this->header.record_size));
    header.Set("string_block_size", Napi::Number::New(env, this->header.string_block_size));

    return header;
}

Napi::Value DBCFile::WriteTo(const Napi::CallbackInfo& info) {
Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string new_filepath = info[0].As<Napi::String>().Utf8Value();
    std::ofstream file(new_filepath, std::ios::binary | std::ios::trunc);
    if (!file) {
        if (errno == ENOENT || errno == EACCES) {
            Napi::Error::New(env, "Invalid file path or permission denied").ThrowAsJavaScriptException();
        } else {
            Napi::Error::New(env, "Could not open file for writing").ThrowAsJavaScriptException();
        }
        return env.Null();
    }

    // Update header
    this->header.record_count = this->records.size();
    this->header.string_block_size = this->string_block.size();

    file.write(reinterpret_cast<char*>(&this->header), sizeof(DBCHeader));

    for (const auto& record : this->records) {
        for (const auto& field : record) {
            file.write(reinterpret_cast<const char*>(&field.value), sizeof(uint32_t));
        }
    }

    file.write(this->string_block.c_str(), this->string_block.size());

    file.close();

    return env.Undefined();
}

Napi::Value DBCFile::FindBy(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string field_name = info[0].As<Napi::String>().Utf8Value();
    Napi::Value search_value = info[1];

    auto field_it = std::find_if(this->field_definitions.begin(), this->field_definitions.end(),
                                 [&field_name](const auto& pair) { return pair.first == field_name; });
    if (field_it == this->field_definitions.end()) {
        Napi::Error::New(env, "Invalid field name").ThrowAsJavaScriptException();
        return env.Null();
    }

    uint32_t field_index = std::distance(this->field_definitions.begin(), field_it);
    FieldType field_type = field_it->second;

    Napi::Array results = Napi::Array::New(env);
    uint32_t result_count = 0;

    for (uint32_t i = 0; i < this->records.size(); i++) {
        const FieldValue& field_value = this->records[i][field_index];
        bool match = false;

        switch (field_type) {
            case FieldType::TYPE_UINT32:
                match = field_value.value.uint32_value == search_value.As<Napi::Number>().Uint32Value();
                break;
            case FieldType::TYPE_INT32:
                match = field_value.value.int32_value == search_value.As<Napi::Number>().Int32Value();
                break;
            case FieldType::TYPE_FLOAT:
                match = field_value.value.float_value == search_value.As<Napi::Number>().FloatValue();
                break;
            case FieldType::TYPE_STRING:
                match = strcmp(&this->string_block[field_value.value.string_offset],
                               search_value.As<Napi::String>().Utf8Value().c_str()) == 0;
                break;
        }

        if (match) {
            Napi::Object record = Napi::Object::New(env);
            for (size_t j = 0; j < this->field_definitions.size(); j++) {
                record.Set(this->field_definitions[j].first,
                           FieldValueToNapi(env, this->records[i][j]));
            }
            results.Set(result_count++, record);
        }
    }

    return results;
}

Napi::Value DBCFile::GetFilePath(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::String::New(env, this->filepath);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return DBCFile::Init(env, exports);
}

Napi::Value DBCFile::DeleteRecord(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    uint32_t index = info[0].As<Napi::Number>().Uint32Value();

    if (index >= this->records.size()) {
        Napi::RangeError::New(env, "Invalid record index").ThrowAsJavaScriptException();
        return env.Null();
    }

    this->records.erase(this->records.begin() + index);
    this->header.record_count--;

    return env.Undefined();
}

Napi::Value DBCFile::CreateRecordWithValues(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object values = info[0].As<Napi::Object>();
    std::vector<FieldValue> new_record;

    for (const auto& field_def : this->field_definitions) {
        FieldValue field_value;
        field_value.type = field_def.second;

        if (values.Has(field_def.first)) {
            Napi::Value value = values.Get(field_def.first);
            field_value = NapiToFieldValue(value, field_def.second);
        } else {
            // Set default value if the field is not provided
            switch (field_def.second) {
                case FieldType::TYPE_UINT32:
                case FieldType::TYPE_INT32:
                    field_value.value.uint32_value = 0;
                    break;
                case FieldType::TYPE_FLOAT:
                    field_value.value.float_value = 0.0f;
                    break;
                case FieldType::TYPE_STRING:
                    field_value.value.string_offset = this->string_block.size();
                    this->string_block.push_back('\0');
                    break;
            }
        }

        new_record.push_back(field_value);
    }

    this->records.push_back(new_record);
    this->header.record_count++;

    return Napi::Number::New(env, this->records.size() - 1);
}

NODE_API_MODULE(dbcfile, Init);

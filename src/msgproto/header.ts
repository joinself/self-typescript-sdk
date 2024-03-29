// automatically generated by the FlatBuffers compiler, do not modify

import * as flatbuffers from 'flatbuffers';

import { MsgType } from '../msgproto/msg-type';


export class Header {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
__init(i:number, bb:flatbuffers.ByteBuffer):Header {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsHeader(bb:flatbuffers.ByteBuffer, obj?:Header):Header {
  return (obj || new Header()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsHeader(bb:flatbuffers.ByteBuffer, obj?:Header):Header {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new Header()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

id():string|null
id(optionalEncoding:flatbuffers.Encoding):string|Uint8Array|null
id(optionalEncoding?:any):string|Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
}

msgtype():MsgType {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? this.bb!.readInt8(this.bb_pos + offset) : MsgType.MSG;
}

static startHeader(builder:flatbuffers.Builder) {
  builder.startObject(2);
}

static addId(builder:flatbuffers.Builder, idOffset:flatbuffers.Offset) {
  builder.addFieldOffset(0, idOffset, 0);
}

static addMsgtype(builder:flatbuffers.Builder, msgtype:MsgType) {
  builder.addFieldInt8(1, msgtype, MsgType.MSG);
}

static endHeader(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  return offset;
}

static finishHeaderBuffer(builder:flatbuffers.Builder, offset:flatbuffers.Offset) {
  builder.finish(offset);
}

static finishSizePrefixedHeaderBuffer(builder:flatbuffers.Builder, offset:flatbuffers.Offset) {
  builder.finish(offset, undefined, true);
}

static createHeader(builder:flatbuffers.Builder, idOffset:flatbuffers.Offset, msgtype:MsgType):flatbuffers.Offset {
  Header.startHeader(builder);
  Header.addId(builder, idOffset);
  Header.addMsgtype(builder, msgtype);
  return Header.endHeader(builder);
}
}

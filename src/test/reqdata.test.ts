import chai from "chai";
import 'mocha';
import * as rule from "../rule";
import * as resolver from "../resolver";
import { exampleRules } from './rules.test';
import { expect } from 'chai';
import { findResolver } from '../resolver';
import { parseRequestUrl } from "../reqdata";

describe('parseRequestUrl()', () => {
    it('Single request data', async () => {
        const data = parseRequestUrl("test.com", "/home/data")

        expect(data.host).is.equals("test.com")
        expect(data.path).is.equals("/home/data")
        expect(JSON.stringify(data.hostParts)).is.equals('["com","test"]')
        expect(JSON.stringify(data.pathParts)).is.equals('["home","data"]')
    })

    it('No host request data', async () => {
        const data = parseRequestUrl("", "/home/data")

        expect(data.host).is.equals("")
        expect(data.path).is.equals("/home/data")
        expect(JSON.stringify(data.hostParts)).is.equals('[]')
        expect(JSON.stringify(data.pathParts)).is.equals('["home","data"]')
    })

    it('No path request data', async () => {
        const data = parseRequestUrl("wow.de", "")

        expect(data.host).is.equals("wow.de")
        expect(data.path).is.equals("")
        expect(JSON.stringify(data.hostParts)).is.equals('["de","wow"]')
        expect(JSON.stringify(data.pathParts)).is.equals('[]')
    })

    it('Large host request data', async () => {
        const data = parseRequestUrl(
            "test.test.majo.sysdev.test.test.test.com.test.net",
            "/home/data"
        )

        expect(data.host).is.equals(
            "test.test.majo.sysdev.test.test.test.com.test.net"
        )
        expect(data.path).is.equals("/home/data")
        expect(JSON.stringify(data.hostParts)).is.equals(
            '["net","test","com","test","test","test","sysdev","majo","test","test"]'
        )
        expect(JSON.stringify(data.pathParts)).is.equals('["home","data"]')
    })

    it('Large path request data', async () => {
        const data = parseRequestUrl(
            "example.com",
            "/home/data/data/sysdev/majo/var/var/var"
        )

        expect(data.host).is.equals("example.com")
        expect(data.path).is.equals(
            "/home/data/data/sysdev/majo/var/var/var"
        )
        expect(JSON.stringify(data.hostParts)).is.equals('["com","example"]')
        expect(JSON.stringify(data.pathParts)).is.equals(
            '["home","data","data","sysdev","majo","var","var","var"]'
        )
    })
})
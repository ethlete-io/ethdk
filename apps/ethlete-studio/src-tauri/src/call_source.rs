#[derive(Debug)]
pub struct Node {
    pub start: usize,
    pub end: usize,
    pub value: Value,
}

#[derive(Debug)]
pub struct Property {
    pub key: String,
    pub start: usize,
    pub node: Node,
}

#[derive(Debug)]
pub enum Value {
    Text(String),
    Number(f64),
    List(Vec<Node>),
    Object(Vec<Property>),
    Other,
}

impl Node {
    pub fn properties(&self) -> &[Property] {
        match &self.value {
            Value::Object(properties) => properties,
            _ => &[],
        }
    }

    pub fn items(&self) -> &[Node] {
        match &self.value {
            Value::List(items) => items,
            _ => &[],
        }
    }

    pub fn property(&self, key: &str) -> Option<&Property> {
        self.properties().iter().find(|property| property.key == key)
    }

    pub fn text(&self, key: &str) -> Option<&str> {
        match &self.property(key)?.node.value {
            Value::Text(text) => Some(text),
            _ => None,
        }
    }

    pub fn number(&self, key: &str) -> Option<f64> {
        match self.property(key)?.node.value {
            Value::Number(number) => Some(number),
            _ => None,
        }
    }

    pub fn list(&self, key: &str) -> &[Node] {
        self.property(key).map_or(&[], |property| property.node.items())
    }
}

/// The object passed to `defineCall(…)`, or `None` when the source declares no call.
pub fn call_object(source: &str) -> Option<Node> {
    let mut reader = Reader {
        bytes: source.as_bytes(),
        source,
        at: 0,
    };

    loop {
        reader.skip_trivia();

        match reader.peek()? {
            quote @ (b'\'' | b'"' | b'`') => {
                reader.string(quote);
            }
            _ if source[reader.at..].starts_with("defineCall(") => {
                reader.at += "defineCall(".len();
                reader.skip_trivia();

                if reader.peek() == Some(b'{') {
                    return Some(reader.value());
                }
            }
            _ => reader.at += 1,
        }
    }
}

struct Reader<'a> {
    bytes: &'a [u8],
    source: &'a str,
    at: usize,
}

impl Reader<'_> {
    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.at).copied()
    }

    fn skip_trivia(&mut self) {
        while let Some(byte) = self.peek() {
            if byte.is_ascii_whitespace() {
                self.at += 1;
            } else if self.source[self.at..].starts_with("//") {
                self.at = self.source[self.at..]
                    .find('\n')
                    .map_or(self.bytes.len(), |end| self.at + end);
            } else if self.source[self.at..].starts_with("/*") {
                self.at = self.source[self.at + 2..]
                    .find("*/")
                    .map_or(self.bytes.len(), |end| self.at + 2 + end + 2);
            } else {
                break;
            }
        }
    }

    fn value(&mut self) -> Node {
        let start = self.at;
        let value = match self.peek() {
            Some(b'{') => self.object(),
            Some(b'[') => self.list(),
            Some(quote @ (b'\'' | b'"' | b'`')) => self.string(quote),
            Some(byte) if byte.is_ascii_digit() || byte == b'-' => self.number(),
            _ => {
                self.skip_expression();
                Value::Other
            }
        };

        Node {
            start,
            end: self.at,
            value,
        }
    }

    fn object(&mut self) -> Value {
        self.at += 1;
        let mut properties = Vec::new();

        loop {
            self.skip_trivia();

            match self.peek() {
                None => break,
                Some(b'}') => {
                    self.at += 1;
                    break;
                }
                Some(b',') => {
                    self.at += 1;
                    continue;
                }
                _ => {}
            }

            let start = self.at;
            let key = self.property_name();
            self.skip_trivia();

            if key.is_none() || self.peek() != Some(b':') {
                self.skip_expression();
                continue;
            }

            self.at += 1;
            self.skip_trivia();
            let node = self.value();

            if let Some(key) = key {
                properties.push(Property { key, start, node });
            }
        }

        Value::Object(properties)
    }

    fn property_name(&mut self) -> Option<String> {
        match self.peek()? {
            quote @ (b'\'' | b'"') => match self.string(quote) {
                Value::Text(text) => Some(text),
                _ => None,
            },
            byte if byte.is_ascii_alphabetic() || byte == b'_' || byte == b'$' => {
                let start = self.at;

                while self
                    .peek()
                    .is_some_and(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$')
                {
                    self.at += 1;
                }

                Some(self.source[start..self.at].to_owned())
            }
            _ => None,
        }
    }

    fn list(&mut self) -> Value {
        self.at += 1;
        let mut items = Vec::new();

        loop {
            self.skip_trivia();

            match self.peek() {
                None => break,
                Some(b']') => {
                    self.at += 1;
                    break;
                }
                Some(b',') => self.at += 1,
                _ => items.push(self.value()),
            }
        }

        Value::List(items)
    }

    fn string(&mut self, quote: u8) -> Value {
        self.at += 1;
        let mut text = String::new();
        let mut interpolates = false;
        let mut chars = self.source[self.at..].char_indices();

        while let Some((offset, character)) = chars.next() {
            match character {
                '\\' => {
                    if let Some((_, escaped)) = chars.next() {
                        text.push(match escaped {
                            'n' => '\n',
                            't' => '\t',
                            other => other,
                        });
                    }
                }
                '$' if quote == b'`' && self.source[self.at + offset..].starts_with("${") => {
                    interpolates = true;
                    let mut depth = 0_usize;

                    for (_, inner) in chars.by_ref() {
                        match inner {
                            '{' => depth += 1,
                            '}' => {
                                depth -= 1;

                                if depth == 0 {
                                    break;
                                }
                            }
                            _ => {}
                        }
                    }
                }
                character if character as u32 == u32::from(quote) => {
                    self.at += offset + 1;

                    return if interpolates { Value::Other } else { Value::Text(text) };
                }
                character => text.push(character),
            }
        }

        self.at = self.bytes.len();
        Value::Other
    }

    fn number(&mut self) -> Value {
        let start = self.at;

        while self
            .peek()
            .is_some_and(|byte| byte.is_ascii_digit() || matches!(byte, b'.' | b'-' | b'_' | b'e' | b'E'))
        {
            self.at += 1;
        }

        self.source[start..self.at]
            .replace('_', "")
            .parse()
            .map_or(Value::Other, Value::Number)
    }

    fn skip_expression(&mut self) {
        let mut depth = 0_usize;
        let mut last = self.at;

        loop {
            self.skip_trivia();

            let Some(byte) = self.peek() else { break };

            match byte {
                b'\'' | b'"' | b'`' => {
                    self.string(byte);
                }
                b'(' | b'[' | b'{' => {
                    depth += 1;
                    self.at += 1;
                }
                b')' | b']' | b'}' if depth > 0 => {
                    depth -= 1;
                    self.at += 1;
                }
                b',' | b')' | b']' | b'}' if depth == 0 => break,
                _ => self.at += 1,
            }

            last = self.at;
        }

        self.at = last;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_call_object_reads_its_fields_and_skips_what_it_does_not_model() {
        let source = "import { defineCall } from 'x';\n// defineCall({ key: 'no' })\nexport default defineCall({\n  /* note */ headline: 'H',\n  frameWidth: 360,\n  variants: [\n    { key: 'a', claim: \"the key: b\", load: () => import('./variant-a') },\n    { 'key': `c`, cost: `${1}` },\n  ],\n});\n";
        let call = call_object(source).expect("a call");
        let variants = call.list("variants");

        assert_eq!(call.text("headline"), Some("H"));
        assert_eq!(call.number("frameWidth"), Some(360.0));
        assert_eq!(variants.len(), 2);
        assert_eq!(variants[0].text("key"), Some("a"));
        assert_eq!(variants[0].text("claim"), Some("the key: b"));
        assert!(matches!(
            variants[0].property("load").map(|p| &p.node.value),
            Some(Value::Other)
        ));
        assert_eq!(variants[1].text("key"), Some("c"));
        assert_eq!(variants[1].text("cost"), None);
    }

    #[test]
    fn a_source_without_a_call_reads_none() {
        assert!(call_object("export default {};").is_none());
    }
}

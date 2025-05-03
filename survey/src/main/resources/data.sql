INSERT INTO survey(id, name, schema_json)
SELECT
    '23e4693c-3975-4d91-a2f2-190993043c1c',
    'Initial Survey',
    '{"questions":[
        {"id":"1","text":"What is your name?","type":"text"},
        {"id":"2","text":"How old are you?","type":"numeric"},
        {"id":"3","text":"What is your favorite color?","type":"text"},
        {"id":"4","text":"What is your preferred contact method?","type":"multiple_choice","options":["Email","Phone"]}
      ]}'
WHERE NOT EXISTS (SELECT 1 FROM survey WHERE name = 'Initial Survey');

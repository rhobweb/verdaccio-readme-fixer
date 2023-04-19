/**
 * DESCRIPTION:
 * Unit Tests for pg-client package.
 */
'use strict';

const sinon      = require( 'sinon' );
const { expect } = require( 'chai' );
const rewire     = require( 'rewire' );
const path       = require( 'path' );

const REL_SRC_PATH  = '../../src/';
const MODULE_NAME   = 'readme-fixer';
const TEST_MODULE   = REL_SRC_PATH + MODULE_NAME;
const REL_TEST_PATH = '../test/unit/'; // Relative path from the SRC dir to the unit test dir

// Backslash needs double escape
const PATH_SEPARATOR = ( process.platform === 'win32' ? '\\\\' : '/' );

let sandbox;

/**
 * Modules load other modules, so to force a module reload need to delete
 * the test module and all child modules from the require cache.
 */
function unrequireModules() {
  const arrKey = [ require.resolve(TEST_MODULE),
                 ];
  for (let i in arrKey) {
    let key = arrKey[i];
    delete require.cache[key];
  }
}

function commonBeforeEach() {
  unrequireModules();
  sandbox = sinon.createSandbox();
}

function commonAfterEach() {
  sandbox.restore();
  unrequireModules();
}

function createTestModule() {
  const testModule = rewire( TEST_MODULE );
  return testModule;
}

function createTestModuleAndGetProps( arrProp = [] ) {
  const testModule = createTestModule();
  const testProps  = {};
  arrProp.forEach( m => { 
    testProps[ m ] = testModule.__get__( m );
  } );
  const result = { testModule, testProps };
  return result;
}

function getPrivateStubs( testModule, arrFnName = [] ) {
  const testStubs   = {};
  const testDummies = {};

  arrFnName.forEach( fnName => {
    testStubs[ fnName ]   = () => {};
    testDummies[ fnName ] = ( ...args ) => testStubs[ fnName ]( ...args );
    testModule.__set__( fnName, testDummies[ fnName ] );
  } );

  return testStubs;
}

describe(MODULE_NAME + ':module can be loaded', () => {

  beforeEach( () => {
    commonBeforeEach();
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ('module initialises OK', () => {
    createTestModule();
  });

  it ('module initialises OK with win32 platform', () => {
    sandbox.stub( process, 'platform' ).value( 'win32' );
    createTestModule();
  });

  it ('module initialises OK with linux platform', () => {
    sandbox.stub( process, 'platform' ).value( 'linux' );
    createTestModule();
  });
});

describe(MODULE_NAME + ':genBackupPathname', () => {
  let testFnName = 'genBackupPathname';
  let testModule;
  let testFn;
  let testProps;
  let testArgs;
  let testBackupDir;
  let actualResult;
  let expectedResult;

  beforeEach( () => {
    commonBeforeEach();
    ( { testModule, testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn                      = testProps[ testFnName ];
    testBackupDir               = 'TestBackupDir';
    testModule.__set__( 'BACKUP_DIR', testBackupDir );
  });

  afterEach( () => {
    commonAfterEach();
    testModule = null;
  });

  it ('Simple pathname', () => {
    testArgs       = 'package.json';
    expectedResult = new RegExp( `^${testBackupDir}${PATH_SEPARATOR}tmp-package-json\.[0-9]+$` );
    actualResult   = testFn( testArgs );
    expect( actualResult ).to.match( expectedResult );
  });

  it ('Pathname with slashes', () => {
    testArgs       = 'dir1/subdir2/package.json';
    expectedResult = new RegExp( `^${testBackupDir}${PATH_SEPARATOR}tmp-dir1-subdir2-package-json\.[0-9]+$` );
    actualResult   = testFn( testArgs );
    expect( actualResult ).to.match( expectedResult );
  });

  it ('Pathname with backslashes', () => {
    testArgs       = 'dir1\\subdir2\\package.json';
    expectedResult = new RegExp( `^${testBackupDir}${PATH_SEPARATOR}tmp-dir1-subdir2-package-json\.[0-9]+$` );
    actualResult   = testFn( testArgs );
    expect( actualResult ).to.match( expectedResult );
  });

  it ('Pathname with dots', () => {
    testArgs       = 'dirdot.subdir/package.json';
    expectedResult = new RegExp( `^${testBackupDir}${PATH_SEPARATOR}tmp-dirdot-subdir-package-json\.[0-9]+$` );
    actualResult   = testFn( testArgs );
    expect( actualResult ).to.match( expectedResult );
  });

  it ('Pathname with colon', () => {
    testArgs       = 'C:\\dir\\subdir/package.json';
    expectedResult = new RegExp( `^${testBackupDir}${PATH_SEPARATOR}tmp-C--dir-subdir-package-json\.[0-9]+$` );
    actualResult   = testFn( testArgs );
    expect( actualResult ).to.match( expectedResult );
  });
});

describe(MODULE_NAME + ':genPackagePathname', () => {
  let testFnName = 'genPackagePathname';
  let testFn;
  let testProps;
  let testArgs;
  let actualResult;
  let expectedResult;

  beforeEach( () => {
    commonBeforeEach();
    ( { testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn          = testProps[ testFnName ];
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ('Full pathname', () => {
    testArgs       = path.resolve( __dirname, './data/README.md' );
    expectedResult = path.resolve( __dirname, './data/package.json' );
    actualResult   = testFn( testArgs );
    expect( actualResult ).to.equal( expectedResult );
  });

  it ('Relative pathname', () => {
    testArgs       = './data/README.md';
    expectedResult = path.resolve( __dirname, REL_SRC_PATH, '../', './data/package.json' );
    actualResult   = testFn( testArgs );
    expect( actualResult ).to.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':readFile', () => {
  let testFnName = 'readFile';
  let testFn;
  let testModule;
  let testProps;
  let testFS;
  let testPathname;
  let actualResult;
  let expectedResult;
  let actualErr;
  let expectedErrMessage
  let existsSyncStub;
  let existsSyncRet;
  let existsSyncExpectedArgs;
  let readFileSyncStub;
  let readFileSyncRet;
  let readFileSyncExpectedArgs;

  beforeEach( () => {
    commonBeforeEach();
    ( { testModule, testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn    = testProps[ testFnName ];
    testFS = {
      existsSync:   () => {},
      readFileSync: () => {},
    };
    testModule.__set__( 'fs', testFS );
    testPathname   = 'test pathname';
    existsSyncStub = sandbox.stub( testFS, 'existsSync' ).callsFake( () => {
      return existsSyncRet;
    } );
    existsSyncRet = true;
    existsSyncExpectedArgs = [ existsSyncStub, testPathname ];
    readFileSyncStub = sandbox.stub( testFS, 'readFileSync' ).callsFake( () => {
      return readFileSyncRet;
    } );
    readFileSyncRet = 'test readFileSync ret';
    readFileSyncExpectedArgs = [ readFileSyncStub, testPathname, { encoding: 'utf-8' } ];
  });

  afterEach( () => {
    commonAfterEach();
    testModule = null;
  });

  it ('No pathname', () => {
    testPathname       = undefined;
    expectedErrMessage = 'No pathname specified';
    try {
      testFn( testPathname );
    }
    catch ( err ) {
      actualErr = err;
    }
    sinon.assert.notCalled( existsSyncStub );
    sinon.assert.notCalled( readFileSyncStub );
    expect( actualErr.message ).to.equal( expectedErrMessage );
  });

  it ('File does not exist', () => {
    existsSyncRet      = false;
    expectedErrMessage = `File not found: ${testPathname}`;
    try {
      testFn( testPathname );
    }
    catch ( err ) {
      actualErr = err;
    }
    sinon.assert.calledWithExactly.apply( null, existsSyncExpectedArgs );
    sinon.assert.notCalled( readFileSyncStub );
    expect( actualErr.message ).to.equal( expectedErrMessage );
  });

  it ('OK', () => {
    expectedResult = readFileSyncRet;
    try {
      actualResult = testFn( testPathname );
    }
    catch ( err ) {
      sinon.assert.fail( `Test should not fail: ${err.message}` );
    }
    sinon.assert.calledWithExactly.apply( null, existsSyncExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, readFileSyncExpectedArgs );
    expect( actualResult ).to.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':deleteFile', () => {
  let testFnName = 'deleteFile';
  let testFn;
  let testModule;
  let testProps;
  let testStubs;
  let testFS;
  let testFSP;
  let testPathname;
  let actualResult;
  let expectedResult;
  let genBackupPathnameStub;
  let genBackupPathnameRet;
  let genBackupPathnameExpectedArgs;
  let copyFileSyncStub;
  let copyFileSyncRet;
  let copyFileSyncExpectedArgs;
  let unlinkStub;
  let unlinkRet;
  let unlinkExpectedArgs;

  beforeEach( () => {
    commonBeforeEach();
    ( { testModule, testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn    = testProps[ testFnName ];
    testStubs = getPrivateStubs( testModule, [ 'genBackupPathname' ] );
    testFS = {
      copyFileSync: () => {},
    };
    testFSP = {
      unlink: () => {},
    };
    testModule.__set__( 'fs', testFS );
    testModule.__set__( 'fsp', testFSP );
    testPathname = 'test pathname';
    genBackupPathnameStub = sandbox.stub( testStubs, 'genBackupPathname' ).callsFake( () => {
      return genBackupPathnameRet;
    } );
    genBackupPathnameExpectedArgs = [ genBackupPathnameStub, testPathname ];
    genBackupPathnameRet = 'test genBackupPathname ret';
    copyFileSyncStub = sandbox.stub( testFS, 'copyFileSync' ).callsFake( () => {
      return copyFileSyncRet;
    } );
    copyFileSyncRet = true;
    copyFileSyncExpectedArgs = [ copyFileSyncStub, testPathname, genBackupPathnameRet ];
    unlinkStub = sandbox.stub( testFSP, 'unlink' ).callsFake( async () => {
      return unlinkRet;
    } );
    unlinkRet          = 'test unlink ret';
    unlinkExpectedArgs = [ unlinkStub, testPathname ];
    expectedResult     = { backupPathname: genBackupPathnameRet };
  });

  afterEach( () => {
    commonAfterEach();
    testModule = null;
  });

  it ('OK', async () => {
    actualResult = await testFn( testPathname );
    sinon.assert.calledWithExactly.apply( null, genBackupPathnameExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, copyFileSyncExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, unlinkExpectedArgs );
    expect( actualResult ).to.deep.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':writeFile', () => {
  let testFnName = 'writeFile';
  let testFn;
  let testModule;
  let testProps;
  let testArgsArr;
  let testFS;
  let testPathname;
  let testContent;
  let writeFileSyncStub;
  let writeFileSyncRet;
  let writeFileSyncExpectedArgs;

  beforeEach( () => {
    commonBeforeEach();
    ( { testModule, testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn = testProps[ testFnName ];
    testFS = {
      writeFileSync: () => {},
    };
    testModule.__set__( 'fs', testFS );
    testPathname = 'test pathname';
    testContent  = 'test content';
    testArgsArr  = [ testPathname, testContent ];
    writeFileSyncStub = sandbox.stub( testFS, 'writeFileSync' ).callsFake( () => {
      return writeFileSyncRet;
    } );
    writeFileSyncRet = true;
    writeFileSyncExpectedArgs = [ writeFileSyncStub, testPathname, testContent, { encoding: 'utf-8' } ];
  });

  afterEach( () => {
    commonAfterEach();
    testModule = null;
  });

  it ('OK', () => {
    testFn( ...testArgsArr );
    sinon.assert.calledWithExactly.apply( null, writeFileSyncExpectedArgs );
  });
});

describe(MODULE_NAME + ':writeFileJSON', () => {
  let testFnName = 'writeFileJSON';
  let testFn;
  let testModule;
  let testProps;
  let testStubs;
  let testArgsArr;
  let testPathname;
  let testRawContent;
  let writeFileStub;
  let writeFileExpectedArgs;

  beforeEach( () => {
    commonBeforeEach();
    ( { testModule, testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn = testProps[ testFnName ];
    testStubs = getPrivateStubs( testModule, [ 'writeFile' ] );
    testPathname   = 'test pathname';
    testRawContent = { p1: 'raw content' };
    testArgsArr  = [ testPathname, testRawContent ];
    writeFileStub = sandbox.stub( testStubs, 'writeFile' ).callsFake( () => {} );
    writeFileExpectedArgs = [ writeFileStub, testPathname, '{\n  \"p1\": \"raw content\"\n}' ];
  });

  afterEach( () => {
    commonAfterEach();
    testModule = null;
  });

  it ('OK', () => {
    testFn( ...testArgsArr );
    sinon.assert.calledWithExactly.apply( null, writeFileExpectedArgs );
  });
});

describe(MODULE_NAME + ':loadPackage', () => {
  let testFnName = 'loadPackage';
  let testFn;
  let testProps;
  let testPathname;
  let actualResult;
  let expectedResult;

  beforeEach( () => {
    commonBeforeEach();
    ( { testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn       = testProps[ testFnName ];
    testPathname = path.join( REL_TEST_PATH, 'data/package.json' );
    expectedResult = {
      "readme": "Dummy README text"
    };
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ('OK', () => {
    actualResult = testFn( testPathname );
    expect( actualResult ).to.deep.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':updatePackage', () => {
  let testFnName = 'updatePackage';
  let testFn;
  let testModule;
  let testProps;
  let testStubs;
  let testArgs;
  let testPathname;
  let testReadmeText;
  let testBackupPathname;
  let loadPackageStub;
  let loadPackageRet;
  let loadPackageExpectedArgs;
  let deleteFileStub;
  let deleteFileRet;
  let deleteFileExpectedArgs;
  let writeFileJSONStub;
  let writeFileJSONExpectedParams;
  let writeFileJSONExpectedArgs;
  let actualResult;
  let expectedResult;

  beforeEach( () => {
    commonBeforeEach();
    ( { testModule, testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn          = testProps[ testFnName ];
    testStubs       = getPrivateStubs( testModule, [ 'loadPackage', 'deleteFile', 'writeFileJSON' ] );
    testPathname    = 'test pathname';
    testReadmeText  = 'test readme text';
    testArgs        = { packagePathname: testPathname, readmeText: testReadmeText };
    testBackupPathname = 'test backupPathname';
    loadPackageStub = sandbox.stub( testStubs, 'loadPackage' ).callsFake( () => {
      return loadPackageRet;
    } );
    loadPackageRet              = { p1: 'val1', readme: 'original readme text' };
    loadPackageExpectedArgs     = [ loadPackageStub, testPathname ];
    deleteFileStub              = sandbox.stub( testStubs, 'deleteFile' ).callsFake( () => {
      return deleteFileRet;
    } );
    deleteFileRet               = { backupPathname: testBackupPathname };
    deleteFileExpectedArgs      = [ deleteFileStub, testPathname ];
    writeFileJSONStub           = sandbox.stub( testStubs, 'writeFileJSON' ).callsFake( () => {} );
    writeFileJSONExpectedParams = [ testPathname, { p1: 'val1', readme: testReadmeText } ];
    writeFileJSONExpectedArgs   = [ writeFileJSONStub, ...writeFileJSONExpectedParams ];
    expectedResult              = { backupPackagePathname: testBackupPathname };
  });

  afterEach( () => {
    commonAfterEach();
    testModule = null;
  });

  it ('OK', async () => {
    actualResult = await testFn( testArgs );
    sinon.assert.calledWithExactly.apply( null, loadPackageExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, deleteFileExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, writeFileJSONExpectedArgs );
    expect( actualResult ).to.deep.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':encodeTags', () => {
  let testFnName = 'encodeTags';
  let testFn;
  let testProps;
  let testArgsArr;
  let testRawContent;
  let testRegex;
  let testTagPrefix;
  let actualResult;
  let expectedResult;

  beforeEach( () => {
    commonBeforeEach();
    ( { testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn = testProps[ testFnName ];
    testRawContent = 'not much';
    testRegex      = /BB./g;
    testTagPrefix  = 'MyT';
    testArgsArr = [ testRawContent, testRegex, testTagPrefix ];
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'No tags found', () => {
    expectedResult = { tags: {}, cookedContent: testRawContent };
    actualResult   = testFn( ...testArgsArr );
    expect( actualResult ).to.deep.equal( expectedResult );
  });

  it ( 'Lots of tags found', () => {
    testRawContent = 'BBisBBwasBBhas BBdoesBBgillBB BBcanBBmayBBshall BBwonBBlostBBflew';
    testArgsArr    = [ testRawContent, testRegex, testTagPrefix ];
    expectedResult = {
      tags: {
        "!TAG!MyT00": 'BBi',
        "!TAG!MyT01": 'BBw',
        "!TAG!MyT02": 'BBh',
        "!TAG!MyT03": 'BBd',
        "!TAG!MyT04": 'BBg',
        "!TAG!MyT05": 'BB ',
        "!TAG!MyT06": 'BBc',
        "!TAG!MyT07": 'BBm',
        "!TAG!MyT08": 'BBs',
        "!TAG!MyT09": 'BBw',
        "!TAG!MyT10": 'BBl',
        "!TAG!MyT11": 'BBf',
      },
      cookedContent: '!TAG!MyT00s!TAG!MyT01as!TAG!MyT02as !TAG!MyT03oes!TAG!MyT04ill!TAG!MyT05!TAG!MyT06an!TAG!MyT07ay!TAG!MyT08hall !TAG!MyT01on!TAG!MyT10ost!TAG!MyT11lew'
    };
    actualResult   = testFn( ...testArgsArr );
    expect( actualResult ).to.deep.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':encodeTagsPreformatted', () => {
  let testFnName = 'encodeTagsPreformatted';
  let testFn;
  let testModule;
  let testProps;
  let testStubs;
  let testArgs;
  let testRegex;
  let testTagPrefix;
  let actualResult;
  let expectedResult;
  let encodeTagsStub;
  let encodeTagsExpectedArgs;
  let encodeTagsRet;

  beforeEach( () => {
    commonBeforeEach();
    ( { testModule, testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn         = testProps[ testFnName ];
    testStubs      = getPrivateStubs( testModule, [ 'encodeTags' ] );
    testArgs       = 'test text';
    testRegex      = new RegExp( '<pre>.*?</pre>', 'ig' );
    testTagPrefix  = 'PREF';
    encodeTagsStub = sandbox.stub( testStubs, 'encodeTags' ).callsFake( () => {
      return encodeTagsRet;
    } );
    encodeTagsRet  = 'test encodeTags ret';
    encodeTagsExpectedArgs = [ encodeTagsStub, testArgs, testRegex, testTagPrefix  ];
    expectedResult = encodeTagsRet;
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'OK', () => {
    actualResult = testFn( testArgs );
    sinon.assert.calledWithExactly.apply( null, encodeTagsExpectedArgs );
    expect( actualResult ).to.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':encodeTagsPreformatted not stubbed', () => {
  let testFnName = 'encodeTagsPreformatted';
  let testFn;
  let testProps;
  let testArgs;
  let testRegex;
  let testTagPrefix;
  let actualResult;
  let expectedResult;

  beforeEach( () => {
    commonBeforeEach();
    ( { testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn         = testProps[ testFnName ];
    testArgs       = '<div><pRe>My preformatted text 1</Pre></div><pre>Preformatted 2</pre>';
    testRegex      = new RegExp( '<pre>.*?</pre>', 'ig' );
    testTagPrefix  = 'PREF';
    expectedResult = {
      tags: {
        '!TAG!PREF00': '<pRe>My preformatted text 1</Pre>',
        '!TAG!PREF01': '<pre>Preformatted 2</pre>',
      },
      cookedContent: '<div>!TAG!PREF00</div>!TAG!PREF01'
    };
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'OK', () => {
    actualResult = testFn( testArgs );
    expect( actualResult ).to.deep.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':encodeTagsLinks', () => {
  let testFnName = 'encodeTagsLinks';
  let testFn;
  let testModule;
  let testProps;
  let testStubs;
  let testArgs;
  let testRegex;
  let testTagPrefix;
  let actualResult;
  let expectedResult;
  let encodeTagsStub;
  let encodeTagsExpectedArgs;
  let encodeTagsRet;

  beforeEach( () => {
    commonBeforeEach();
    ( { testModule, testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn         = testProps[ testFnName ];
    testStubs      = getPrivateStubs( testModule, [ 'encodeTags' ] );
    testArgs       = 'test text';
    testRegex      = new RegExp( '\\[[^\\]\n\r]+\\]\\(#[^)\n\r]+\\)', 'g' );
    testTagPrefix  = 'LINK';
    encodeTagsStub = sandbox.stub( testStubs, 'encodeTags' ).callsFake( () => {
      return encodeTagsRet;
    } );
    encodeTagsRet  = 'test encodeTags ret';
    encodeTagsExpectedArgs = [ encodeTagsStub, testArgs, testRegex, testTagPrefix  ];
    expectedResult = encodeTagsRet;
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'OK', () => {
    actualResult = testFn( testArgs );
    sinon.assert.calledWithExactly.apply( null, encodeTagsExpectedArgs );
    expect( actualResult ).to.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':encodeTagsLinks not stubbed', () => {
  let testFnName = 'encodeTagsLinks';
  let testFn;
  let testProps;
  let testArgs;
  let testTagPrefix;
  let actualResult;
  let expectedResult;

  beforeEach( () => {
    commonBeforeEach();
    ( { testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn         = testProps[ testFnName ];
    testArgs       = '<div>[My (#link) text 1](#internalLink1)</div><div>[My link text 99](#internalLink99)</div>';
    testTagPrefix  = 'LINK';
    expectedResult = {
      tags: {
        '!TAG!LINK00': '[My (#link) text 1](#internalLink1)',
        '!TAG!LINK01': '[My link text 99](#internalLink99)',
      },
      cookedContent: '<div>!TAG!LINK00</div><div>!TAG!LINK01</div>'
    };
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'OK', () => {
    actualResult = testFn( testArgs );
    expect( actualResult ).to.deep.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':decodeTags', () => {
  let testFnName = 'decodeTags';
  let testFn;
  let testProps;
  let testArgsArr;
  let testEncodedContent;
  let testTags;
  let actualResult;
  let expectedResult;

  beforeEach( () => {
    commonBeforeEach();
    ( { testProps }    = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn             = testProps[ testFnName ];
    testEncodedContent = 'TAG01TAG02 is TAG03';
    testTags = {
      'TAG01': 'Fre',
      'TAG02': 'd',
      'TAG03': 'dead!',
    };
    testArgsArr = [ testEncodedContent, testTags ];
    expectedResult = 'Fred is dead!';
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'OK', () => {
    actualResult = testFn( ...testArgsArr );
    expect( actualResult ).to.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':genFixedLink', () => {
  let testFnName = 'genFixedLink';
  let testFn;
  let testProps;
  let testArgsArr;
  let testRawLink;
  let testBaseHref;
  let actualResult;
  let expectedResult;

  beforeEach( () => {
    commonBeforeEach();
    ( { testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn          = testProps[ testFnName ];
    testRawLink     = '[My Link](#pagelink)';
    testBaseHref    = 'https://mydomain/mypage';
    testArgsArr     = [ testRawLink, testBaseHref ];
    expectedResult  = `[My Link](${testBaseHref}#pagelink)`;
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'OK', () => {
    actualResult = testFn( ...testArgsArr );
    expect( actualResult ).to.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':fixLinks', () => {
  let testFnName = 'fixLinks';
  let testFn;
  let testModule;
  let testProps;
  let testStubs;
  let testArgsArr;
  let testRawText;
  let testBaseHref;
  let actualResult;
  let expectedResult;
  let testPreformattedTags;
  let testPreformattedText;
  let testLinksTags;
  let testLinksText;
  let encodeTagsPreformattedStub;
  let encodeTagsPreformattedRet;
  let encodeTagsPreformattedExpectedArgs;
  let encodeTagsLinksStub;
  let encodeTagsLinksRet;
  let encodeTagsLinksExpectedArgs;
  let genFixedLinkStub;
  let genFixedLinkRetArr;
  let genFixedLinkExpectedArgsArr;
  let decodeTagsStub;
  let decodeTagsRetArr;
  let decodeTagsExpectedArgsArr;

  beforeEach( () => {
    commonBeforeEach();
    ( { testModule, testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn          = testProps[ testFnName ];
    testStubs       = getPrivateStubs( testModule, [ 'encodeTagsPreformatted', 'encodeTagsLinks', 'genFixedLink', 'decodeTags' ] );
    testRawText     = 'Fred: [My Link](#pagelink) <pre>Unedited link[Unchanged Link](#unchangedlink)</pre>\n\rBert: [My Link](#pagelink)';
    testBaseHref    = 'https://mydomain/mypage';
    testArgsArr     = [ testRawText, testBaseHref ];
    testPreformattedTags = { tag1: 'pre1', tag2: 'pre2' };
    testPreformattedText = 'test preformatted text';
    testLinksTags        = { tag3: 'links3', tag4: 'links4' }; 
    testLinksText        = 'test links text';
    encodeTagsPreformattedStub = sandbox.stub( testStubs, 'encodeTagsPreformatted' ).callsFake( () => {
      return encodeTagsPreformattedRet;
    } );
    encodeTagsPreformattedRet          = { tags: testPreformattedTags, cookedContent: testPreformattedText };
    encodeTagsPreformattedExpectedArgs = [ encodeTagsPreformattedStub, testRawText ];
    encodeTagsLinksStub = sandbox.stub( testStubs, 'encodeTagsLinks' ).callsFake( () => {
      return encodeTagsLinksRet;
    } );
    encodeTagsLinksRet = { tags: testLinksTags, cookedContent: testLinksText };
    encodeTagsLinksExpectedArgs = [ encodeTagsLinksStub, testPreformattedText ];
    genFixedLinkStub = sandbox.stub( testStubs, 'genFixedLink' ).callsFake( () => {
      return genFixedLinkRetArr.shift();
    } );
    genFixedLinkRetArr = [ 'fixedLinks3', 'fixedLinks4' ];
    genFixedLinkExpectedArgsArr = [
      [ genFixedLinkStub, testLinksTags.tag3, testBaseHref ],
      [ genFixedLinkStub, testLinksTags.tag4, testBaseHref ],
    ];
    decodeTagsStub = sandbox.stub( testStubs, 'decodeTags' ).callsFake( () => {
      return decodeTagsRetArr.shift();
    } );
    decodeTagsRetArr = [
      'test decodeTags ret 1',
      'test decodeTags ret 2',
    ];
    decodeTagsExpectedArgsArr = [
      [ decodeTagsStub, testLinksText, { tag3: 'fixedLinks3', tag4: 'fixedLinks4' } ],
      [ decodeTagsStub, decodeTagsRetArr[0], testPreformattedTags ],
    ];
    expectedResult = decodeTagsRetArr[ 1 ];
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'OK', () => {
    actualResult = testFn( ...testArgsArr );
    sinon.assert.calledWithExactly.apply( null, encodeTagsPreformattedExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, encodeTagsLinksExpectedArgs );
    sinon.assert.callCount( genFixedLinkStub, 2 );
    sinon.assert.calledWithExactly.apply( null, genFixedLinkExpectedArgsArr.shift() );
    sinon.assert.calledWithExactly.apply( null, genFixedLinkExpectedArgsArr.shift() );
    sinon.assert.callCount( decodeTagsStub, 2 );
    sinon.assert.calledWithExactly.apply( null, decodeTagsExpectedArgsArr.shift() );
    sinon.assert.calledWithExactly.apply( null, decodeTagsExpectedArgsArr.shift() );
    expect( actualResult ).to.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':fixLinks no stubs', () => {
  let testFnName = 'fixLinks';
  let testFn;
  let testProps;
  let testArgsArr;
  let testRawText;
  let testBaseHref;
  let actualResult;
  let expectedResult;

  beforeEach( () => {
    commonBeforeEach();
    ( { testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn          = testProps[ testFnName ];
    testRawText     = 'Fred: [My Link](#pagelink) <pre>Unedited link[Unchanged Link](#unchangedlink)</pre>\n\rBert: [My Link](#pagelink)';
    testBaseHref    = 'https://mydomain/mypage';
    testArgsArr     = [ testRawText, testBaseHref ];
    expectedResult  = 'Fred: [My Link](https://mydomain/mypage#pagelink) <pre>Unedited link[Unchanged Link](#unchangedlink)</pre>\n\rBert: [My Link](https://mydomain/mypage#pagelink)';
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'OK', () => {
    actualResult = testFn( ...testArgsArr );
    expect( actualResult ).to.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':genBaseHref', () => {
  let testFnName = 'genBaseHref';
  let testFn;
  let testProps;
  let testArgs;
  let testPackageName;
  let testRegistry;
  const testDefaultRegistry = 'http://localhost:4873';
  let actualResult;
  let expectedResult;

  function genExpectedResult( registry ) {
    const expectedBaseHref = registry + '/-/web/detail/' + testPackageName + '?';
    return {
      baseHref:     expectedBaseHref,
      baseHrefText: '<base href="' + expectedBaseHref + '">',
    };
  }

  beforeEach( () => {
    commonBeforeEach();
    ( { testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn          = testProps[ testFnName ];
    testPackageName = 'MyPackage';
    testRegistry    = 'MyRegistry';
    testArgs = {
      name: testPackageName,
      publishConfig: {
        registry: testRegistry,
      },
    };
    expectedResult = genExpectedResult( testRegistry );
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'Registry specified', () => {
    expectedResult = genExpectedResult( testRegistry );
    actualResult   = testFn( testArgs );
    expect( actualResult ).to.deep.equal( expectedResult );
  });

  it ( 'Package does not contain publishConfig.registry', () => {
    delete testArgs.publishConfig.registry;
    expectedResult = genExpectedResult( testDefaultRegistry );
    actualResult   = testFn( testArgs );
    expect( actualResult ).to.deep.equal( expectedResult );
  });

  it ( 'Package does not contain publishConfig', () => {
    delete testArgs.publishConfig;
    expectedResult = genExpectedResult( testDefaultRegistry );
    actualResult   = testFn( testArgs );
    expect( actualResult ).to.deep.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':fixReadmeText', () => {
  let testFnName = 'fixReadmeText';
  let testFn;
  let testModule;
  let testProps;
  let testStubs;
  let testPackageContent;
  let testRawReadmeText;
  let testArgs;
  let testBaseHref;
  let genBaseHrefStub;
  let genBaseHrefRet;
  let genBaseHrefExpectedArgs;
  let fixLinksStub;
  let fixLinksRet;
  let fixLinksExpectedArgs;
  let actualResult;
  let expectedResult;

  beforeEach( () => {
    commonBeforeEach();
    ( { testModule, testProps } = createTestModuleAndGetProps( [ testFnName ] ) );
    testFn             = testProps[ testFnName ];
    testStubs          = getPrivateStubs( testModule, [ 'genBaseHref', 'fixLinks' ] );
    testPackageContent = 'test packageContent';
    testRawReadmeText  = 'test rawReadmeText';
    testArgs = {
      packageContent: testPackageContent,
      rawReadmeText:  testRawReadmeText,
    };
    testBaseHref    = 'test baseHref ret';
    genBaseHrefStub = sandbox.stub( testStubs, 'genBaseHref' ).callsFake( () => {
      return genBaseHrefRet;
    } );
    genBaseHrefRet = { baseHref: testBaseHref };
    genBaseHrefExpectedArgs = [ genBaseHrefStub, testPackageContent ];
    fixLinksStub = sandbox.stub( testStubs, 'fixLinks' ).callsFake( () => {
      return fixLinksRet;
    } );
    fixLinksRet = 'test fixLinksRet';
    fixLinksExpectedArgs = [ fixLinksStub, testRawReadmeText, testBaseHref ];
    expectedResult = fixLinksRet;
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'OK', () => {
    actualResult = testFn( testArgs );
    sinon.assert.calledWithExactly.apply( null, genBaseHrefExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, fixLinksExpectedArgs );
    expect( actualResult ).to.equal( expectedResult );
  });
});

describe(MODULE_NAME + ':processReadme', () => {
  let testModule;
  let testProps;
  let testStubs;
  let testPackageContent;
  let testRawReadmeText;
  let testArgs;
  let readFileStub;
  let readFileRet;
  let readFileExpectedArgs;
  let genPackagePathnameStub;
  let genPackagePathnameRet;
  let genPackagePathnameExpectedArgs;
  let loadPackageStub;
  let loadPackageRet;
  let loadPackageExpectedArgs;
  let fixReadmeTextStub;
  let fixReadmeTextRet;
  let fixReadmeTextExpectedParams;
  let fixReadmeTextExpectedArgs;
  let updatePackageStub;
  let updatePackageRet;
  let updatePackageExpectedParams;
  let updatePackageExpectedArgs;
  let actualResult;
  let expectedResult;
  const testDefaultPathname = './README.md';

  beforeEach( () => {
    commonBeforeEach();
    ( { testModule } = createTestModuleAndGetProps() );
    testStubs        = getPrivateStubs( testModule, [ 'readFile', 'genPackagePathname', 'loadPackage', 'fixReadmeText', 'updatePackage' ] );
    testArgs         = 'test pathname';
    readFileStub     = sandbox.stub( testStubs, 'readFile' ).callsFake( () => {
      return readFileRet;
    } );
    readFileRet          = 'test readFile ret';
    readFileExpectedArgs = [ readFileStub, testArgs ];
    genPackagePathnameStub = sandbox.stub( testStubs, 'genPackagePathname' ).callsFake( () => {
      return genPackagePathnameRet;
    } );
    genPackagePathnameRet          = 'test genPackagePathname ret';
    genPackagePathnameExpectedArgs = [ genPackagePathnameStub, testArgs ];
    loadPackageStub = sandbox.stub( testStubs, 'loadPackage' ).callsFake( () => {
      return loadPackageRet;
    } );
    loadPackageRet = 'test loadPackage ret';
    loadPackageExpectedArgs = [ loadPackageStub, genPackagePathnameRet ];
    fixReadmeTextStub = sandbox.stub( testStubs, 'fixReadmeText' ).callsFake( () => {
      return fixReadmeTextRet;
    } );
    fixReadmeTextExpectedParams = { rawReadmeText: readFileRet, packageContent: loadPackageRet };
    fixReadmeTextExpectedArgs   = [ fixReadmeTextStub, fixReadmeTextExpectedParams ];
    updatePackageStub = sandbox.stub( testStubs, 'updatePackage' ).callsFake( async () => {
      return updatePackageRet;
    } );
    updatePackageRet = { p1: 'updatePackage ret' };
    updatePackageExpectedParams = {
      packagePathname: genPackagePathnameRet,
      readmeText:      fixReadmeTextRet,
    };
    updatePackageExpectedArgs   = [ updatePackageStub, updatePackageExpectedParams ];
    expectedResult = JSON.parse( JSON.stringify( updatePackageRet ) );
    expectedResult.packagePathname = genPackagePathnameRet;
  });

  afterEach( () => {
    commonAfterEach();
  });

  it ( 'OK, pathname', async () => {
    actualResult = await testModule.processReadme( testArgs );
    sinon.assert.calledWithExactly.apply( null, readFileExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, genPackagePathnameExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, loadPackageExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, fixReadmeTextExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, updatePackageExpectedArgs );
    expect( actualResult ).to.deep.equal( expectedResult );
  });

  it ( 'OK, default pathname', async () => {
    readFileExpectedArgs[ 1 ]           = testDefaultPathname;
    genPackagePathnameExpectedArgs[ 1 ] = testDefaultPathname;
    actualResult = await testModule.processReadme();
    sinon.assert.calledWithExactly.apply( null, readFileExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, genPackagePathnameExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, loadPackageExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, fixReadmeTextExpectedArgs );
    sinon.assert.calledWithExactly.apply( null, updatePackageExpectedArgs );
    expect( actualResult ).to.deep.equal( expectedResult );
  });
});
